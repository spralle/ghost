// Plugin schema ingestion bridge — extracts config schemas from plugin contracts

import type { ConfigurationPropertySchema } from "@ghost-shell/contracts/plugin";
import {
  composeConfigurationSchemas,
  createSchemaRegistry,
  deriveNamespace,
} from "@weaver/config-engine";
import type {
  ComposedSchemaEntry,
  ComposeResult,
  ConfigurationSchemaDeclaration,
  ConfigurationSchemaRegistry,
  RegisterSchemaResult,
  SchemaCompositionError,
  UnregisterSchemaResult,
} from "@weaver/config-engine";

// Re-export weaver types so downstream consumers can still import from this module
export type {
  ComposedSchemaEntry,
  ComposeResult,
  ConfigurationSchemaDeclaration,
  ConfigurationSchemaRegistry,
  RegisterSchemaResult,
  SchemaCompositionError,
  UnregisterSchemaResult,
};

/**
 * Minimal plugin configuration input to avoid circular dependency
 * on @ghost-shell/contracts.
 */
export interface PluginConfigInput {
  pluginId: string;
  configuration?: ConfigurationPropertySchema | undefined;
}

/**
 * Extracts ConfigurationSchemaDeclaration entries from plugin contracts.
 * Plugins without a `configuration` block are skipped.
 */
export function collectPluginSchemaDeclarations(plugins: PluginConfigInput[]): ConfigurationSchemaDeclaration[] {
  const declarations: ConfigurationSchemaDeclaration[] = [];

  for (const plugin of plugins) {
    if (plugin.configuration === undefined) continue;
    const properties = plugin.configuration.properties;
    if (properties === undefined) continue;

    declarations.push({
      ownerId: plugin.pluginId,
      namespace: deriveNamespace(plugin.pluginId),
      properties: properties as Record<string, ConfigurationPropertySchema>,
    });
  }

  return declarations;
}

/**
 * Collects plugin schema declarations and composes them into a unified schema map.
 * Returns the ComposeResult including duplicate-key errors if present.
 */
export function buildSchemaMap(plugins: PluginConfigInput[]): ComposeResult {
  const declarations = collectPluginSchemaDeclarations(plugins);
  return composeConfigurationSchemas(declarations);
}

export interface IncrementalSchemaRegistryAdapter {
  registerPlugin(plugin: PluginConfigInput): RegisterSchemaResult;
  unregisterPlugin(pluginId: string): UnregisterSchemaResult;
  getSchema(fullyQualifiedKey: string): ComposedSchemaEntry | undefined;
  getSchemas(): Map<string, ComposedSchemaEntry>;
  getSchemasByOwner(pluginId: string): Map<string, ComposedSchemaEntry>;
  getCompositionErrors(): SchemaCompositionError[];
}

class DefaultIncrementalSchemaRegistryAdapter implements IncrementalSchemaRegistryAdapter {
  private readonly registry: ConfigurationSchemaRegistry = createSchemaRegistry();

  registerPlugin(plugin: PluginConfigInput): RegisterSchemaResult {
    if (plugin.configuration === undefined || plugin.configuration.properties === undefined) {
      this.registry.unregister(plugin.pluginId);
      return { registeredKeys: [], errors: [] };
    }

    return this.registry.register({
      ownerId: plugin.pluginId,
      namespace: deriveNamespace(plugin.pluginId),
      properties: plugin.configuration.properties as Record<string, ConfigurationPropertySchema>,
    });
  }

  unregisterPlugin(pluginId: string): UnregisterSchemaResult {
    return this.registry.unregister(pluginId);
  }

  getSchema(fullyQualifiedKey: string): ComposedSchemaEntry | undefined {
    return this.registry.getSchema(fullyQualifiedKey);
  }

  getSchemas(): Map<string, ComposedSchemaEntry> {
    return this.registry.getSchemas();
  }

  getSchemasByOwner(pluginId: string): Map<string, ComposedSchemaEntry> {
    return this.registry.getSchemasByOwner(pluginId);
  }

  getCompositionErrors(): SchemaCompositionError[] {
    return this.registry.getCompositionErrors();
  }
}

export function createIncrementalSchemaRegistryAdapter(): IncrementalSchemaRegistryAdapter {
  return new DefaultIncrementalSchemaRegistryAdapter();
}

// Backward compatibility aliases
export type IncrementalPluginSchemaRegistry = IncrementalSchemaRegistryAdapter;
export const createIncrementalPluginSchemaRegistry = createIncrementalSchemaRegistryAdapter;
