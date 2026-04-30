import type { PluginServices } from "@ghost-shell/contracts";
import type { LayerRegistry } from "@ghost-shell/layer";
import { evaluateShellPluginCompatibility } from "@ghost-shell/plugin-system";
import type { CapabilityRegistry } from "./capability-registry.js";
import { buildActivationPlan } from "./plugin-activation-plan.js";
import {
  createActivationContext,
  createGhostApi,
  type GhostApiFactoryDependencies,
} from "./plugin-api/ghost-api-factory.js";
import type { PluginLoadStrategy } from "./plugin-loader.js";
import { PluginLoadError } from "./plugin-loader.js";
import { pushDiagnostic, transitionLifecycle } from "./plugin-registry-diagnostics.js";
import type {
  PluginActivationTrigger,
  PluginRegistryDiagnostic,
  PluginRuntimeFailure,
  PluginRuntimeState,
  ShellPluginRegistry,
} from "./plugin-registry-types.js";

const SHELL_CONTRACT_DECLARATION = "^1.0.0";

export function createActivationController(
  states: Map<string, PluginRuntimeState>,
  diagnostics: PluginRegistryDiagnostic[],
  pluginLoader: PluginLoadStrategy,
  capabilityRegistry: CapabilityRegistry,
  apiDeps?: GhostApiFactoryDependencies,
  layerRegistry?: LayerRegistry | null,
  pluginServices?: PluginServices | null,
): (pluginId: string, trigger: PluginActivationTrigger) => Promise<boolean> {
  return async (pluginId, trigger) => {
    const state = states.get(pluginId);
    if (!state) {
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId,
        level: "warn",
        code: "UNKNOWN_PLUGIN",
        message: `Activation requested for unknown plugin '${pluginId}' via ${trigger.type}:${trigger.id}.`,
      });
      return false;
    }

    if (!state.enabled) {
      pushDiagnostic(diagnostics, {
        at: new Date().toISOString(),
        pluginId,
        level: "info",
        code: "ACTIVATION_SKIPPED_DISABLED",
        message: `Skipped activation for disabled plugin '${pluginId}' via ${trigger.type}:${trigger.id}.`,
      });
      return false;
    }

    if (state.contract && state.lifecycle.state === "active") {
      state.lifecycle.lastTrigger = trigger;
      return true;
    }

    if (state.activationPromise) {
      await state.activationPromise;
      return state.contract !== null && state.lifecycle.state === "active";
    }

    state.activationPromise = activateState(
      state,
      pluginId,
      trigger,
      diagnostics,
      pluginLoader,
      capabilityRegistry,
      apiDeps,
      layerRegistry ?? null,
      pluginServices,
    );
    await state.activationPromise;
    return state.contract !== null && state.lifecycle.state === "active";
  };
}

async function activateState(
  state: PluginRuntimeState,
  pluginId: string,
  trigger: PluginActivationTrigger,
  diagnostics: PluginRegistryDiagnostic[],
  pluginLoader: PluginLoadStrategy,
  capabilityRegistry: CapabilityRegistry,
  apiDeps?: GhostApiFactoryDependencies,
  layerRegistry?: LayerRegistry | null,
  pluginServices?: PluginServices | null,
): Promise<void> {
  state.failure = null;
  transitionLifecycle(state, "activating", trigger);

  if (!checkActivationCompatibility(state, pluginId, trigger, diagnostics)) {
    return;
  }

  try {
    if (!state.contract) {
      const loadResult = await pluginLoader.loadPluginContract(state.descriptor);
      state.contract = loadResult.contract;
      state.activate = loadResult.activate;
      state.deactivate = loadResult.deactivate ?? null;
    }

    if (!validateAndRegisterCapabilities(state, pluginId, trigger, diagnostics, capabilityRegistry)) {
      return;
    }

    if (!(await runActivateHook(state, pluginId, trigger, diagnostics, capabilityRegistry, apiDeps, pluginServices))) {
      return;
    }

    state.failure = null;
    transitionLifecycle(state, "active", trigger);
    registerLayerContributions(state, pluginId, layerRegistry);
  } catch (error) {
    handleActivationError(state, pluginId, trigger, diagnostics, capabilityRegistry, error);
  }

  state.activationPromise = null;
}

function checkActivationCompatibility(
  state: PluginRuntimeState,
  pluginId: string,
  trigger: PluginActivationTrigger,
  diagnostics: PluginRegistryDiagnostic[],
): boolean {
  const compatibility = evaluateShellPluginCompatibility(
    SHELL_CONTRACT_DECLARATION,
    state.descriptor.compatibility.pluginContract,
  );
  if (!compatibility.compatible) {
    state.contract = null;
    state.activate = null;
    state.failure = {
      code: compatibility.code,
      message: `${compatibility.message} (shell='${SHELL_CONTRACT_DECLARATION}', plugin='${state.descriptor.compatibility.pluginContract}')`,
      retryable: false,
    };
    transitionLifecycle(state, "failed", trigger);
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId,
      level: "warn",
      code: compatibility.code,
      message: state.failure.message,
    });
    state.activationPromise = null;
    return false;
  }
  return true;
}

function validateAndRegisterCapabilities(
  state: PluginRuntimeState,
  pluginId: string,
  trigger: PluginActivationTrigger,
  diagnostics: PluginRegistryDiagnostic[],
  capabilityRegistry: CapabilityRegistry,
): boolean {
  const dependencyFailures = capabilityRegistry.validateDependencies({
    pluginId,
    pluginVersion: state.descriptor.version,
    contract: state.contract!,
  });
  if (dependencyFailures.length > 0) {
    const firstFailure = dependencyFailures[0];
    if (firstFailure) {
      state.failure = {
        code: firstFailure.code,
        message: firstFailure.message,
        retryable: false,
      };
      state.contract = null;
      state.activate = null;
      capabilityRegistry.unregisterPlugin(pluginId);
      transitionLifecycle(state, "failed", trigger);
      for (const failure of dependencyFailures) {
        pushDiagnostic(diagnostics, {
          at: new Date().toISOString(),
          pluginId,
          level: "warn",
          code: failure.code,
          message: failure.message,
        });
      }
      state.activationPromise = null;
      return false;
    }
  }

  capabilityRegistry.registerPlugin(pluginId, state.contract!);
  return true;
}

async function runActivateHook(
  state: PluginRuntimeState,
  pluginId: string,
  trigger: PluginActivationTrigger,
  diagnostics: PluginRegistryDiagnostic[],
  capabilityRegistry: CapabilityRegistry,
  apiDeps?: GhostApiFactoryDependencies,
  pluginServices?: PluginServices | null,
): Promise<boolean> {
  if (!state.activate || !apiDeps) {
    return true;
  }

  const ghostApiInstance = createGhostApi(apiDeps);
  const ctx = createActivationContext(pluginId, pluginServices ?? undefined);

  try {
    await state.activate(ghostApiInstance.api, ctx);
    state.activationSubscriptions = ctx.subscriptions;
    state.ghostApiInstance = ghostApiInstance;
    return true;
  } catch (activateError) {
    const message = activateError instanceof Error ? activateError.message : String(activateError);
    state.failure = {
      code: "ACTIVATE_FAILED",
      message: `Plugin '${pluginId}' activate() failed: ${message}`,
      retryable: false,
    };
    state.contract = null;
    state.activate = null;
    capabilityRegistry.unregisterPlugin(pluginId);
    transitionLifecycle(state, "failed", trigger);
    pushDiagnostic(diagnostics, {
      at: new Date().toISOString(),
      pluginId,
      level: "warn",
      code: "ACTIVATE_FAILED",
      message: state.failure.message,
    });
    state.activationPromise = null;
    return false;
  }
}

function registerLayerContributions(
  state: PluginRuntimeState,
  pluginId: string,
  layerRegistry?: LayerRegistry | null,
): void {
  if (!layerRegistry || !state.contract) {
    return;
  }
  const contributes = state.contract.contributes;
  const pluginLayers = contributes?.layers;
  if (pluginLayers && pluginLayers.length > 0) {
    layerRegistry.registerPluginLayers(pluginId, pluginLayers);
  }
  const pluginSurfaces = contributes?.layerSurfaces;
  if (pluginSurfaces) {
    for (const surface of pluginSurfaces) {
      layerRegistry.registerSurface(pluginId, surface);
    }
  }
}

function handleActivationError(
  state: PluginRuntimeState,
  pluginId: string,
  trigger: PluginActivationTrigger,
  diagnostics: PluginRegistryDiagnostic[],
  capabilityRegistry: CapabilityRegistry,
  error: unknown,
): void {
  const failure = mapPluginLoadFailure(error);
  capabilityRegistry.unregisterPlugin(pluginId);
  state.contract = null;
  state.activate = null;
  state.componentsModule = null;
  state.servicesModule = null;
  state.failure = failure;
  transitionLifecycle(state, "failed", trigger);
  pushDiagnostic(diagnostics, {
    at: new Date().toISOString(),
    pluginId,
    level: "warn",
    code: failure.code,
    message: failure.message,
  });
}

function mapPluginLoadFailure(error: unknown): PluginRuntimeFailure {
  if (isPluginLoadError(error)) {
    return {
      code: error.context.reason,
      message: error.context.message,
      retryable: error.context.reason === "REMOTE_UNAVAILABLE",
    };
  }

  return {
    code: "UNKNOWN_PLUGIN_LOAD_ERROR",
    message: "Plugin failed to load due to an unexpected error.",
    retryable: true,
  };
}

function isPluginLoadError(error: unknown): error is PluginLoadError {
  if (!error || typeof error !== "object") {
    return false;
  }

  return error instanceof PluginLoadError;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

// ---------------------------------------------------------------------------
// Startup activation event
// ---------------------------------------------------------------------------

export interface ActivationFailure {
  pluginId: string;
  reason: string;
  cause?: unknown;
}

export interface StartupActivationResult {
  activated: string[];
  skipped: string[];
  failed: string[];
  failures: ActivationFailure[];
}

/**
 * Eagerly activate all enabled plugins using dependency-aware ordering.
 *
 * 1. **Plan**: a dependency DAG is built from `pluginDependencies` in each
 *    plugin's descriptor (provided by the backend), then topologically
 *    sorted into layers via Kahn's algorithm.
 * 2. **Activate**: each layer is activated concurrently — a plugin only
 *    starts once every plugin it depends on is already active.
 *
 * Plugins that form circular dependencies are rejected upfront.
 */
export async function activateByStartupEvent(
  registry: ShellPluginRegistry,
  onProgress?: () => void,
): Promise<StartupActivationResult> {
  const snapshot = registry.getSnapshot();
  const result: StartupActivationResult = {
    activated: [],
    skipped: [],
    failed: [],
    failures: [],
  };

  const enabled = snapshot.plugins.filter((p) => p.enabled);
  if (enabled.length === 0) return result;

  // Phase 1 — build dependency-aware activation plan from descriptor metadata.
  const planEntries = enabled.map((plugin) => ({
    id: plugin.id,
    pluginDependencies: plugin.descriptor.pluginDependencies ?? [],
  }));
  const plan = buildActivationPlan(planEntries);

  for (const rejection of plan.rejected) {
    result.failed.push(rejection.pluginId);
    result.failures.push({ pluginId: rejection.pluginId, reason: "circular_dependency" });
  }

  // Phase 2 — activate layer by layer; within a layer, concurrently.
  for (const layer of plan.layers) {
    const layerPromises = layer.map(async (pluginId) => {
      try {
        const success = await registry.activateByEvent(pluginId, "onStartup");
        if (success) {
          result.activated.push(pluginId);
        } else {
          result.failed.push(pluginId);
          result.failures.push({ pluginId, reason: "activation_returned_false" });
        }
      } catch (error: unknown) {
        result.failed.push(pluginId);
        result.failures.push({ pluginId, reason: extractErrorMessage(error), cause: error });
      }
      onProgress?.();
    });

    await Promise.all(layerPromises);
  }

  return result;
}
