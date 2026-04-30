import type { PluginContract, PluginServices, ServiceRegistrationOptions } from "@ghost-shell/contracts";
import type { CapabilityRegistry } from "./capability-registry.js";
import { createCapabilityRegistry, pickServiceModuleExport } from "./capability-registry.js";
import { createRuntimeFirstPluginLoader } from "./plugin-loader.js";
import { createActivationController } from "./plugin-registry-activation.js";
import {
  resolveComponentCapabilityFromStates,
  resolveServiceCapabilityFromStates,
} from "./plugin-registry-capabilities.js";
import { readCapabilityServices } from "./plugin-registry-contract.js";
import {
  cloneLifecycle,
  cloneRuntimeFailure,
  mapLoaderDiagnostic,
  pushDiagnostic,
  transitionLifecycle,
} from "./plugin-registry-diagnostics.js";
import {
  cascadeDisableDependents,
  disposeActivationSubscriptions,
  resetRuntimeState,
  safeCallDeactivate,
} from "./plugin-registry-lifecycle.js";
import type {
  PluginActivationTrigger,
  PluginRegistryDiagnostic,
  PluginRuntimeState,
  ShellPluginRegistry,
  ShellPluginRegistryOptions,
} from "./plugin-registry-types.js";

function resolveServiceFromRegistry<T = unknown>(
  serviceId: string,
  capabilityRegistry: CapabilityRegistry,
  states: Map<string, PluginRuntimeState>,
): T | null {
  const provider = capabilityRegistry.resolveService(serviceId, {
    requesterPluginId: "shell",
  });
  if (!provider) return null;

  const state = states.get(provider.providerPluginId);
  if (!state) return null;

  if (state.builtinServiceInstances?.has(serviceId)) {
    return (state.builtinServiceInstances.get(serviceId) as T) ?? null;
  }

  if (state.servicesModule && state.contract) {
    const providerServices = readCapabilityServices(state.contract);
    const cap = providerServices.find((s) => s.id === serviceId);
    if (cap) {
      return (pickServiceModuleExport(state.servicesModule, cap) as T) ?? null;
    }
  }

  return null;
}

export type {
  PluginActivationTrigger,
  PluginActivationTriggerType,
  PluginLifecycleSnapshot,
  PluginLifecycleState,
  PluginRegistryDiagnostic,
  PluginRegistrySnapshot,
  ShellPluginRegistry,
  ShellPluginRegistryOptions,
} from "./plugin-registry-types.js";

export function createShellPluginRegistry(options: ShellPluginRegistryOptions = {}): ShellPluginRegistry {
  const diagnostics: PluginRegistryDiagnostic[] = [];
  const pluginLoader =
    options.pluginLoader ??
    createRuntimeFirstPluginLoader({
      onDiagnostic(diagnostic) {
        pushDiagnostic(diagnostics, mapLoaderDiagnostic(diagnostic));
      },
    });
  const states = new Map<string, PluginRuntimeState>();
  const capabilityRegistry = createCapabilityRegistry(() =>
    Array.from(states.entries()).map(([pluginId, state]) => ({
      pluginId,
      enabled: state.enabled,
      contract: state.contract,
    })),
  );
  // Lazy service accessor for activation contexts — closes over capabilityRegistry
  // and states which are available. Safe because plugins activate after construction.
  const activationServices: PluginServices = {
    getService<T = unknown>(serviceId: string): T | null {
      return resolveServiceFromRegistry<T>(serviceId, capabilityRegistry, states);
    },
    hasService(serviceId: string): boolean {
      return resolveServiceFromRegistry(serviceId, capabilityRegistry, states) !== null;
    },
  };
  const ensureActivated = createActivationController(
    states,
    diagnostics,
    pluginLoader,
    capabilityRegistry,
    options.apiDeps,
    options.layerRegistry ?? null,
    activationServices,
  );
  const listeners = new Set<() => void>();

  function notifyListeners(): void {
    for (const fn of listeners) fn();
  }

  let tenantId = "local";
  const builtinContracts: Array<{
    contract: PluginContract;
    serviceInstances?: Record<string, unknown>;
    module?: unknown;
    serviceOptions?: Record<string, ServiceRegistrationOptions>;
  }> = [];

  async function activateByTrigger(pluginId: string, trigger: { type: string; id: string }): Promise<boolean> {
    const result = await ensureActivated(pluginId, trigger as PluginActivationTrigger);
    notifyListeners();
    return result;
  }

  function seedBuiltinState(
    contract: PluginContract,
    serviceInstances?: Record<string, unknown>,
    module?: unknown,
    serviceOptions?: Record<string, ServiceRegistrationOptions>,
  ): void {
    const pluginId = contract.manifest.id;
    const instanceMap = serviceInstances ? new Map(Object.entries(serviceInstances)) : null;
    const optionsMap = serviceOptions ? new Map(Object.entries(serviceOptions)) : null;
    states.set(pluginId, {
      descriptor: {
        id: pluginId,
        version: contract.manifest.version,
        entry: "builtin://shell",
        compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
      },
      enabled: true,
      loadStrategy: "builtin",
      contract,
      componentsModule: null,
      servicesModule: null,
      failure: null,
      lifecycle: {
        state: "active",
        lastTransitionAt: new Date().toISOString(),
        lastTrigger: null,
      },
      activationPromise: null,
      activate: null,
      activationSubscriptions: [],
      ghostApiInstance: null,
      deactivate: null,
      exports: {},
      builtinServiceInstances: instanceMap,
      builtinServiceOptions: optionsMap,
      builtinModule: module ?? null,
    });
  }

  return {
    registerBuiltinPlugin(
      contract: PluginContract,
      serviceInstances?: Record<string, unknown>,
      module?: unknown,
      serviceOptions?: Record<string, ServiceRegistrationOptions>,
    ) {
      builtinContracts.push({ contract, serviceInstances, module, serviceOptions });
      seedBuiltinState(contract, serviceInstances, module, serviceOptions);
      capabilityRegistry.registerPlugin(contract.manifest.id, contract);
      notifyListeners();
    },
    registerManifestDescriptors(nextTenantId, descriptors) {
      tenantId = nextTenantId;
      states.clear();
      capabilityRegistry.clear();
      // Re-register builtin plugins after clear
      for (const entry of builtinContracts) {
        seedBuiltinState(entry.contract, entry.serviceInstances, entry.module, entry.serviceOptions);
        capabilityRegistry.registerPlugin(entry.contract.manifest.id, entry.contract);
      }
      for (const descriptor of descriptors) {
        states.set(descriptor.id, {
          descriptor,
          enabled: false,
          loadStrategy: pluginLoader.name,
          contract: null,
          componentsModule: null,
          servicesModule: null,
          failure: null,
          lifecycle: {
            state: "disabled",
            lastTransitionAt: new Date().toISOString(),
            lastTrigger: null,
          },
          activationPromise: null,
          activate: null,
          activationSubscriptions: [],
          ghostApiInstance: null,
          deactivate: null,
          exports: {},
          builtinServiceInstances: null,
          builtinServiceOptions: null,
          builtinModule: null,
        });
      }
      notifyListeners();
    },
    async setEnabled(pluginId, enabled) {
      const state = states.get(pluginId);
      if (!state) {
        throw new Error(`Plugin '${pluginId}' is not in registry`);
      }

      state.enabled = enabled;
      if (!enabled) {
        await safeCallDeactivate(state, pluginId, diagnostics);
        disposeActivationSubscriptions(state);
        capabilityRegistry.unregisterPlugin(pluginId);
        if (options.layerRegistry) {
          options.layerRegistry.unregisterPluginLayers(pluginId);
          options.layerRegistry.unregisterSurfaces(pluginId);
        }
        resetRuntimeState(state);
        transitionLifecycle(state, "disabled", null);
        notifyListeners();

        // Cascade-disable dependent plugins
        await cascadeDisableDependents(pluginId, this, diagnostics);
        return;
      }

      resetRuntimeState(state);
      transitionLifecycle(state, "registered", null);
      notifyListeners();
    },
    async activateByAction(pluginId, actionId) {
      return activateByTrigger(pluginId, { type: "action", id: actionId });
    },
    async activateByView(pluginId, viewId) {
      return activateByTrigger(pluginId, { type: "view", id: viewId });
    },
    async activateByIntent(pluginId, intentId) {
      return activateByTrigger(pluginId, { type: "intent", id: intentId });
    },
    async activateByEvent(pluginId, eventName) {
      return activateByTrigger(pluginId, { type: "event", id: eventName });
    },
    async preloadContract(pluginId) {
      const state = states.get(pluginId);
      if (!state?.enabled) return null;
      // Already loaded (builtin or previously preloaded)
      if (state.contract) return state.contract;

      try {
        const loadResult = await pluginLoader.loadPluginContract(state.descriptor);
        // Cache the loaded contract + activate fn so activateState can reuse it.
        state.contract = loadResult.contract;
        state.activate = loadResult.activate;
        state.deactivate = loadResult.deactivate ?? null;
        return loadResult.contract;
      } catch {
        return null;
      }
    },
    async resolveComponentCapability(requesterPluginId, capabilityId) {
      return resolveComponentCapabilityFromStates(
        requesterPluginId,
        capabilityId,
        states,
        capabilityRegistry,
        diagnostics,
        pluginLoader,
      );
    },
    async resolveServiceCapability(requesterPluginId, capabilityId) {
      return resolveServiceCapabilityFromStates(
        requesterPluginId,
        capabilityId,
        states,
        capabilityRegistry,
        diagnostics,
        pluginLoader,
      );
    },
    getService<T = unknown>(serviceId: string): T | null {
      return resolveServiceFromRegistry<T>(serviceId, capabilityRegistry, states);
    },
    getServiceOptions(serviceId: string): ServiceRegistrationOptions | null {
      const provider = capabilityRegistry.resolveService(serviceId, { requesterPluginId: "shell" });
      if (!provider) return null;
      const state = states.get(provider.providerPluginId);
      return state?.builtinServiceOptions?.get(serviceId) ?? null;
    },
    hasService(serviceId: string): boolean {
      return this.getService(serviceId) !== null;
    },
    getBuiltinModule(pluginId: string): unknown | null {
      return states.get(pluginId)?.builtinModule ?? null;
    },
    subscribe(callback: () => void) {
      listeners.add(callback);
      return { dispose: () => listeners.delete(callback) };
    },
    getSnapshot() {
      return {
        tenantId,
        diagnostics: [...diagnostics],
        plugins: Array.from(states.entries()).map(([id, state]) => ({
          id,
          enabled: state.enabled,
          loadStrategy: state.loadStrategy,
          descriptor: state.descriptor,
          contract: state.contract,
          failure: cloneRuntimeFailure(state.failure),
          lifecycle: cloneLifecycle(state),
        })),
      };
    },
  };
}
