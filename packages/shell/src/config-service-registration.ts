// config-service-registration.ts — ConfigurationService shell registration.
//
// Registers the ConfigurationService as a builtin plugin capability,
// following the same pattern as theme-service-registration.ts.

import type { ConfigurationService, PluginContract } from "@ghost-shell/contracts";
import type { ScopedConfigurationService } from "@weaver/config-types";
import { CONFIG_SERVICE_ID } from "@ghost-shell/contracts";
import { deriveNamespace } from "@weaver/config-engine";
import { createScopedConfigurationService } from "@weaver/config-providers";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const CONFIG_SERVICE_PLUGIN_ID = "ghost.shell.config-service";

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
): ScopedConfigurationService {
  const namespace = deriveNamespace(pluginId);
  return createScopedConfigurationService(configService, namespace);
}
