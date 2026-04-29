import type { PluginLoadDiagnostic } from "./plugin-loader.js";
import type { PluginRegistryDiagnostic, PluginRuntimeFailure, PluginRuntimeState } from "./plugin-registry-types.js";

const MAX_DIAGNOSTICS = 30;

export function pushDiagnostic(diagnostics: PluginRegistryDiagnostic[], diagnostic: PluginRegistryDiagnostic): void {
  diagnostics.unshift(diagnostic);
  if (diagnostics.length > MAX_DIAGNOSTICS) {
    diagnostics.length = MAX_DIAGNOSTICS;
  }

  // Surface diagnostics to the console so plugin failures are visible
  const tag = `[plugin:${diagnostic.pluginId}]`;
  if (diagnostic.level === "warn") {
    console.warn(tag, diagnostic.code, diagnostic.message);
    if (diagnostic.cause) {
      console.warn(tag, "  cause:", diagnostic.cause);
    }
  } else {
    console.info(tag, diagnostic.code, diagnostic.message);
  }
}

export function mapLoaderDiagnostic(diagnostic: PluginLoadDiagnostic): PluginRegistryDiagnostic {
  const moduleLabel = diagnostic.module ? ` (${diagnostic.module})` : "";
  return {
    at: new Date().toISOString(),
    pluginId: diagnostic.pluginId,
    level: diagnostic.level,
    code: diagnostic.code,
    message: `${diagnostic.message}${moduleLabel}`,
    cause: diagnostic.cause,
  };
}

export function transitionLifecycle(
  state: PluginRuntimeState,
  nextState: PluginRuntimeState["lifecycle"]["state"],
  trigger: PluginRuntimeState["lifecycle"]["lastTrigger"],
): void {
  state.lifecycle = {
    state: nextState,
    lastTransitionAt: new Date().toISOString(),
    lastTrigger: trigger,
  };
}

export function cloneLifecycle(state: PluginRuntimeState): PluginRuntimeState["lifecycle"] {
  return {
    ...state.lifecycle,
    lastTrigger: state.lifecycle.lastTrigger ? { ...state.lifecycle.lastTrigger } : null,
  };
}

export function cloneRuntimeFailure(failure: PluginRuntimeFailure | null): PluginRuntimeFailure | null {
  return failure ? { ...failure } : null;
}