// plugin-config-catalog-service.ts — Public contract for plugin config catalog access.
//
// Plugins access the catalog via:
//   services.getService<PluginConfigCatalogService>('ghost.pluginConfigCatalog.Service')

import type { ComposedSchemaEntry } from "@ghost-shell/config-plugin-runtime";

/** Read-only view of the plugin configuration catalog for UI consumers. */
export interface PluginConfigCatalogService {
  getSchema(fullyQualifiedKey: string): ComposedSchemaEntry | undefined;
  getSchemas(): ReadonlyMap<string, ComposedSchemaEntry>;
  getSchemasByOwner(pluginId: string): ReadonlyMap<string, ComposedSchemaEntry>;
}

/** Well-known service ID for the PluginConfigCatalogService. */
export const PLUGIN_CONFIG_CATALOG_SERVICE_ID = "ghost.pluginConfigCatalog.Service" as const;
