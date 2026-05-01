// plugin-config-catalog-registration.ts — PluginConfigCatalog shell registration.
//
// Registers the PluginConfigCatalog as a builtin plugin capability,
// following the same pattern as config-service-registration.ts.

import type { PluginContract } from "@ghost-shell/contracts";
import { PLUGIN_CONFIG_CATALOG_SERVICE_ID } from "@ghost-shell/contracts";
import type { PluginConfigCatalog } from "@ghost-shell/config-plugin-runtime";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const PLUGIN_CONFIG_CATALOG_PLUGIN_ID = "ghost.shell.plugin-config-catalog";

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the PluginConfigCatalog as a builtin plugin capability.
 * The catalog is exposed as a read-only service to plugin consumers.
 */
export function registerPluginConfigCatalogCapability(
  registry: ShellPluginRegistry,
  catalog: PluginConfigCatalog,
): void {
  const contract: PluginContract = {
    manifest: {
      id: PLUGIN_CONFIG_CATALOG_PLUGIN_ID,
      name: "Plugin Config Catalog Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [{ id: PLUGIN_CONFIG_CATALOG_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [PLUGIN_CONFIG_CATALOG_SERVICE_ID]: catalog }, undefined, {
    [PLUGIN_CONFIG_CATALOG_SERVICE_ID]: { lazy: true },
  });
}
