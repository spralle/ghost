export { armadaWeaver } from "./armada-layers.js";
export {
  type ConfigurationLifecycleHooks,
  type ConfigurationLifecycleOptions,
  createConfigurationLifecycleHooks,
  createInMemoryPluginSchemaRegistry,
  createInMemorySchemaRegistry,
  createPluginConfigurationLifecycleHooks,
  type PluginConfigLifecycleEvent,
  type PluginConfigLifecycleResult,
  type PluginConfigLifecycleStateContainer,
  type PluginConfigurationLifecycleHooks,
  type PluginConfigurationLifecycleOptions,
  type PluginPromoteOptions,
  type PluginSchemaRegistry,
  type PromoteOptions,
  type SchemaRegistry,
  type SchemaRegistryMutationResult,
} from "./plugin-config-lifecycle-hooks.js";
export {
  // Primary exports (new names)
  composePluginSchemas,
  createPluginConfigCatalog,
  extractPluginSchemas,
  type PluginConfigCatalog,
  // Re-exported weaver types
  type ComposedSchemaEntry,
  type ComposeResult,
  type ConfigurationSchemaDeclaration,
  type ConfigurationSchemaRegistry,
  type PluginConfigInput,
  type RegisterSchemaResult,
  type SchemaCompositionError,
  type UnregisterSchemaResult,
  // Backward compatibility aliases
  buildSchemaMap,
  collectPluginSchemaDeclarations,
  createIncrementalPluginSchemaRegistry,
  createIncrementalSchemaRegistryAdapter,
  type IncrementalPluginSchemaRegistry,
  type IncrementalSchemaRegistryAdapter,
} from "./plugin-config-catalog.js";
