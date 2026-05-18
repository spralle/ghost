export { ghostWeaver } from "./ghost-layers.js";
export {
  type ConfigurationLifecycleHooks,
  type ConfigurationLifecycleOptions,
  createConfigurationLifecycleHooks,
  createInMemorySchemaRegistry,
  type PluginConfigLifecycleEvent,
  type PluginConfigLifecycleResult,
  type PluginConfigLifecycleStateContainer,
  type PromoteOptions,
  type SchemaRegistry,
  type SchemaRegistryMutationResult,
} from "./plugin-config-lifecycle-hooks.js";
export {
  composePluginSchemas,
  createPluginConfigCatalog,
  extractPluginSchemas,
  type PluginConfigCatalog,
  type ComposedSchemaEntry,
  type ComposeResult,
  type ConfigurationSchemaDeclaration,
  type ConfigurationSchemaRegistry,
  type PluginConfigInput,
  type RegisterSchemaResult,
  type SchemaCompositionError,
  type UnregisterSchemaResult,
} from "./plugin-config-catalog.js";
