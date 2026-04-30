// config-service-registration.ts — ConfigurationService shell registration.
//
// Registers the ConfigurationService as a builtin plugin capability,
// following the same pattern as theme-service-registration.ts.

// @weaver/config-types, @weaver/config-providers, @weaver/config-engine removed.
// Stub types and throwing stubs preserve the public API.

import type { ConfigurationService, PluginContract } from "@ghost-shell/contracts";
import { CONFIG_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const CONFIG_SERVICE_PLUGIN_ID = "ghost.shell.config-service";

/** @deprecated Stub — @weaver/config-providers was removed. Returns a passthrough proxy. */
function createScopedConfigurationService(
  configService: ConfigurationService,
  _namespace: string,
): ConfigurationService {
  if (!createScopedConfigurationService._warned) {
    console.warn(
      "[config-service] createScopedConfigurationService is a no-op stub (@weaver/config-providers removed)",
    );
    createScopedConfigurationService._warned = true;
  }
  return configService;
}
createScopedConfigurationService._warned = false;

/** @deprecated Stub — @weaver/config-engine was removed. Returns the pluginId as-is. */
function deriveNamespace(pluginId: string): string {
  if (!deriveNamespace._warned) {
    console.warn("[config-service] deriveNamespace is a no-op stub (@weaver/config-engine removed)");
    deriveNamespace._warned = true;
  }
  return pluginId;
}
deriveNamespace._warned = false;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the ConfigurationService as a builtin plugin capability.
 * Follows the same pattern as registerThemeServiceCapability.
 */
export function registerConfigurationServiceCapability(
  registry: ShellPluginRegistry,
  configService: ConfigurationService,
): void {
  const contract: PluginContract = {
    manifest: {
      id: CONFIG_SERVICE_PLUGIN_ID,
      name: "Configuration Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [{ id: CONFIG_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [CONFIG_SERVICE_ID]: configService }, undefined, {
    [CONFIG_SERVICE_ID]: { lazy: true },
  });
}

// ---------------------------------------------------------------------------
// Scoped service factory for plugin activation
// ---------------------------------------------------------------------------

/**
 * Create a ScopedConfigurationService for a plugin.
 * Called during plugin activation to give each plugin namespace-scoped
 * config access.
 */
export function createScopedServiceForPlugin(
  configService: ConfigurationService,
  pluginId: string,
): ConfigurationService {
  const namespace = deriveNamespace(pluginId);
  return createScopedConfigurationService(configService, namespace);
}
