/**
 * Adapter functions that wire bootPopoutWindow() into the shell's
 * plugin loading and activation systems.
 */

import type { ActivationContext, PluginContract, PluginServices } from "@ghost-shell/contracts";
import { resolveActivationEntry } from "./activation-resolution.js";
import type { ShellFederationRuntime } from "./federation-runtime.js";
import type { PluginActivateFunction } from "./plugin-loader.js";
import type { ServiceGatewayTransport } from "./projected-plugin-services.js";
import { createProjectedPluginServices } from "./projected-plugin-services.js";
import type { ScompPeer } from "./scomp-runtime.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PopoutPluginLoaderDeps {
  readonly federationRuntime: ShellFederationRuntime;
  readonly scompPeer: ScompPeer;
  readonly serviceGatewayTransport: ServiceGatewayTransport;
}

export interface PopoutPartMounterDeps {
  readonly mountElement?: HTMLElement;
}

// ---------------------------------------------------------------------------
// Plugin Loader Adapter
// ---------------------------------------------------------------------------

/**
 * Creates the loadPlugin callback for bootPopoutWindow.
 * Loads a plugin via Module Federation, resolves its activation entry,
 * and calls it with projected services.
 */
export function createPopoutPluginLoader(deps: PopoutPluginLoaderDeps): (pluginId: string, remoteEntry: string) => Promise<void> {
  const projectedServices = createProjectedPluginServices(deps.serviceGatewayTransport);

  return async (pluginId: string, remoteEntry: string): Promise<void> => {
    deps.federationRuntime.registerRemote({ id: pluginId, entry: remoteEntry });

    const rawModule = await deps.federationRuntime.loadPluginContract(pluginId);
    const { contract, activate, exports } = extractModuleArtifacts(rawModule);

    const runtimeContext: Record<string, unknown> = { isSecondary: true };
    const resolvedEntry = resolveActivationEntry(contract, exports, runtimeContext);
    const activationFn = (resolvedEntry ?? activate) as PluginActivateFunction | null;

    if (!activationFn) {
      return;
    }

    const activationContext = createPopoutActivationContext(pluginId, projectedServices);
    await activationFn({} as never, activationContext);
  };
}

// ---------------------------------------------------------------------------
// Part Mounter Adapter (placeholder)
// ---------------------------------------------------------------------------

/**
 * Creates the mountPart callback for bootPopoutWindow.
 * Placeholder — actual DOM mounting is a future concern.
 */
export function createPopoutPartMounter(_deps: PopoutPartMounterDeps): (partId: string, pluginId: string, state?: unknown) => Promise<void> {
  return async (_partId: string, _pluginId: string, _state?: unknown): Promise<void> => {
    // Part mounting is handled by the shell's existing part host system.
    // This placeholder satisfies the boot sequence contract.
  };
}

// ---------------------------------------------------------------------------
// Activation Context
// ---------------------------------------------------------------------------

function createPopoutActivationContext(pluginId: string, services: PluginServices): ActivationContext {
  const subscriptions: Disposable[] = [];

  return {
    pluginId,
    subscriptions,
    services,
    createState<S extends object>(initial: S): S {
      return initial;
    },
    registerService(_token, implementation, _options) {
      // In popout, local services are instantiated independently.
      // Non-local services are already proxied via projectedServices.
      return { [Symbol.dispose]() {} };
    },
  };
}

// ---------------------------------------------------------------------------
// Module extraction helper
// ---------------------------------------------------------------------------

interface ExtractedModule {
  contract: PluginContract;
  activate: PluginActivateFunction | null;
  exports: Record<string, Function>;
}

function extractModuleArtifacts(rawModule: unknown): ExtractedModule {
  const exports: Record<string, Function> = {};
  let activate: PluginActivateFunction | null = null;
  let contractData: unknown = rawModule;

  if (rawModule && typeof rawModule === "object") {
    const record = rawModule as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "function") {
        exports[key] = value as Function;
      }
    }
    if (typeof record.activate === "function") {
      activate = record.activate as PluginActivateFunction;
    }
    if ("pluginContract" in record) {
      contractData = record.pluginContract;
    } else if ("default" in record) {
      contractData = record.default;
    }
  }

  const contract = (contractData && typeof contractData === "object" && "manifest" in (contractData as Record<string, unknown>))
    ? contractData as PluginContract
    : { manifest: { id: "unknown", version: "0.0.0", name: "unknown" } } as unknown as PluginContract;

  return { contract, activate, exports };
}
