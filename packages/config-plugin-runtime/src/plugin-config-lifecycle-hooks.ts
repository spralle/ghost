import type { ConfigurationPropertySchema } from "@ghost-shell/contracts/plugin";
import type { ComposeResult, ConfigurationSchemaDeclaration } from "./plugin-schema-bridge.js";
import { collectPluginSchemaDeclarations } from "./plugin-schema-bridge.js";

// @weaver/config-types removed — inline stub types
/** Stub for ConfigurationLayer (@weaver/config-types removed). */
type ConfigurationLayer = "core" | "app" | "tenant" | "user" | "session" | "module";

/** Stub for SchemaCompositionError (@weaver/config-engine removed). */
interface SchemaCompositionError {
  key: string;
  owners: string[];
  message: string;
}

// @weaver/config-engine removed — stub throws
function composeConfigurationSchemas(_declarations: ConfigurationSchemaDeclaration[]): ComposeResult {
  throw new Error("@weaver/config-engine is not available");
}

// @weaver/config-engine removed — stub
function deriveNamespace(pluginId: string): string {
  // Simple derivation: use pluginId as namespace
  return pluginId;
}

// @weaver/config-engine removed — stub
function qualifyKey(namespace: string, relativeKey: string): string {
  return `${namespace}.${relativeKey}`;
}

import type { PluginConfigInput } from "./plugin-schema-bridge.js";

export type PluginConfigLifecycleEvent = "install" | "uninstall" | "enable" | "disable" | "promote";

export interface PluginConfigLifecycleStateContainer {
  applyLayerData(layer: string, entries: Record<string, unknown>): void;
  getLayerEntries(layer: string): Record<string, unknown>;
}

export interface SchemaRegistryMutationResult {
  ok: boolean;
  errors: SchemaCompositionError[];
}

export interface SchemaRegistry {
  register(declaration: ConfigurationSchemaDeclaration): SchemaRegistryMutationResult;
  unregister(ownerId: string): void;
  snapshot(): ComposeResult;
}

interface PluginRuntimeState {
  plugin: PluginConfigInput;
  enabled: boolean;
}

export interface PluginConfigLifecycleResult {
  event: PluginConfigLifecycleEvent;
  pluginId: string;
  schemaErrors: SchemaCompositionError[];
  changedKeys: string[];
}

export interface PromoteOptions {
  pluginId: string;
  fromLayer: ConfigurationLayer | string;
  toLayer: ConfigurationLayer | string;
}

export interface ConfigurationLifecycleHooks {
  install(plugin: PluginConfigInput): PluginConfigLifecycleResult;
  uninstall(pluginId: string): PluginConfigLifecycleResult;
  enable(pluginId: string): PluginConfigLifecycleResult;
  disable(pluginId: string): PluginConfigLifecycleResult;
  promote(options: PromoteOptions): PluginConfigLifecycleResult;
  getPluginState(pluginId: string): Readonly<{ installed: boolean; enabled: boolean }>;
  getSchemaComposition(): ComposeResult;
}

export interface ConfigurationLifecycleOptions {
  stateContainer: PluginConfigLifecycleStateContainer;
  activeLayer?: ConfigurationLayer | string;
  schemaRegistry?: SchemaRegistry;
}

export function createInMemorySchemaRegistry(
  initialDeclarations: ConfigurationSchemaDeclaration[] = [],
): SchemaRegistry {
  const declarationsByOwner = new Map<string, ConfigurationSchemaDeclaration>();

  for (const declaration of initialDeclarations) {
    declarationsByOwner.set(declaration.ownerId, declaration);
  }

  function composeSnapshot(): ComposeResult {
    return composeConfigurationSchemas([...declarationsByOwner.values()]);
  }

  return {
    register(declaration: ConfigurationSchemaDeclaration): SchemaRegistryMutationResult {
      const previous = declarationsByOwner.get(declaration.ownerId);
      declarationsByOwner.set(declaration.ownerId, declaration);

      const snapshot = composeSnapshot();
      if (snapshot.errors.length > 0) {
        if (previous === undefined) {
          declarationsByOwner.delete(declaration.ownerId);
        } else {
          declarationsByOwner.set(declaration.ownerId, previous);
        }
        return { ok: false, errors: snapshot.errors };
      }

      return { ok: true, errors: [] };
    },

    unregister(ownerId: string): void {
      declarationsByOwner.delete(ownerId);
    },

    snapshot(): ComposeResult {
      return composeSnapshot();
    },
  };
}

function collectDefaultEntries(plugin: PluginConfigInput): Record<string, unknown> {
  if (plugin.configuration === undefined || plugin.configuration.properties === undefined) {
    return {};
  }

  const namespace = deriveNamespace(plugin.pluginId);
  const defaults: Record<string, unknown> = {};

  for (const [relativeKey, schema] of Object.entries(plugin.configuration.properties)) {
    const typedSchema = schema as ConfigurationPropertySchema;
    if (typedSchema.default === undefined) continue;
    const fqKey = qualifyKey(namespace, relativeKey);
    defaults[fqKey] = typedSchema.default;
  }

  return defaults;
}

function removePluginKeys(
  entries: Record<string, unknown>,
  pluginId: string,
): { next: Record<string, unknown>; removedKeys: string[] } {
  const namespacePrefix = `${deriveNamespace(pluginId)}.`;
  const next = { ...entries };
  const removedKeys: string[] = [];

  for (const key of Object.keys(next)) {
    if (!key.startsWith(namespacePrefix)) continue;
    delete next[key];
    removedKeys.push(key);
  }

  return { next, removedKeys };
}

export function createConfigurationLifecycleHooks(options: ConfigurationLifecycleOptions): ConfigurationLifecycleHooks {
  const activeLayer = options.activeLayer ?? "module";
  const schemaRegistry = options.schemaRegistry ?? createInMemorySchemaRegistry();
  const plugins = new Map<string, PluginRuntimeState>();

  function registerPluginSchema(plugin: PluginConfigInput): SchemaRegistryMutationResult {
    const declarations = collectPluginSchemaDeclarations([plugin]);
    if (declarations.length === 0) {
      return { ok: true, errors: [] };
    }
    return schemaRegistry.register(declarations[0]);
  }

  function seedPluginDefaults(plugin: PluginConfigInput): string[] {
    const defaults = collectDefaultEntries(plugin);
    const existing = options.stateContainer.getLayerEntries(activeLayer);
    const changedKeys: string[] = [];

    for (const [key, value] of Object.entries(defaults)) {
      if (existing[key] !== undefined) continue;
      existing[key] = value;
      changedKeys.push(key);
    }

    if (changedKeys.length > 0) {
      options.stateContainer.applyLayerData(activeLayer, existing);
    }

    return changedKeys;
  }

  function setPluginEnabled(pluginId: string, enabled: boolean): void {
    const state = plugins.get(pluginId);
    if (state !== undefined) {
      state.enabled = enabled;
    }
  }

  return {
    install(plugin: PluginConfigInput): PluginConfigLifecycleResult {
      const registration = registerPluginSchema(plugin);
      if (!registration.ok) {
        return {
          event: "install",
          pluginId: plugin.pluginId,
          schemaErrors: registration.errors,
          changedKeys: [],
        };
      }

      plugins.set(plugin.pluginId, { plugin, enabled: true });
      const changedKeys = seedPluginDefaults(plugin);

      return {
        event: "install",
        pluginId: plugin.pluginId,
        schemaErrors: [],
        changedKeys,
      };
    },

    uninstall(pluginId: string): PluginConfigLifecycleResult {
      schemaRegistry.unregister(pluginId);
      plugins.delete(pluginId);

      const activeEntries = options.stateContainer.getLayerEntries(activeLayer);
      const { next, removedKeys } = removePluginKeys(activeEntries, pluginId);
      if (removedKeys.length > 0) {
        options.stateContainer.applyLayerData(activeLayer, next);
      }

      return {
        event: "uninstall",
        pluginId,
        schemaErrors: [],
        changedKeys: removedKeys,
      };
    },

    enable(pluginId: string): PluginConfigLifecycleResult {
      const state = plugins.get(pluginId);
      if (state === undefined) {
        throw new Error(`Plugin "${pluginId}" is not installed`);
      }

      const registration = registerPluginSchema(state.plugin);
      if (!registration.ok) {
        return {
          event: "enable",
          pluginId,
          schemaErrors: registration.errors,
          changedKeys: [],
        };
      }

      setPluginEnabled(pluginId, true);
      const changedKeys = seedPluginDefaults(state.plugin);
      return {
        event: "enable",
        pluginId,
        schemaErrors: [],
        changedKeys,
      };
    },

    disable(pluginId: string): PluginConfigLifecycleResult {
      const state = plugins.get(pluginId);
      if (state === undefined) {
        throw new Error(`Plugin "${pluginId}" is not installed`);
      }

      schemaRegistry.unregister(pluginId);
      setPluginEnabled(pluginId, false);

      const activeEntries = options.stateContainer.getLayerEntries(activeLayer);
      const { next, removedKeys } = removePluginKeys(activeEntries, pluginId);
      if (removedKeys.length > 0) {
        options.stateContainer.applyLayerData(activeLayer, next);
      }

      return {
        event: "disable",
        pluginId,
        schemaErrors: [],
        changedKeys: removedKeys,
      };
    },

    promote({ pluginId, fromLayer, toLayer }: PromoteOptions): PluginConfigLifecycleResult {
      if (!plugins.has(pluginId)) {
        throw new Error(`Plugin "${pluginId}" is not installed`);
      }

      const source = options.stateContainer.getLayerEntries(fromLayer);
      const target = options.stateContainer.getLayerEntries(toLayer);
      const namespacePrefix = `${deriveNamespace(pluginId)}.`;
      const changedKeys: string[] = [];
      const nextTarget = { ...target };

      for (const [key, value] of Object.entries(source)) {
        if (!key.startsWith(namespacePrefix)) continue;
        if (nextTarget[key] === value) continue;
        nextTarget[key] = value;
        changedKeys.push(key);
      }

      if (changedKeys.length > 0) {
        options.stateContainer.applyLayerData(toLayer, nextTarget);
      }

      return {
        event: "promote",
        pluginId,
        schemaErrors: [],
        changedKeys,
      };
    },

    getPluginState(pluginId: string): Readonly<{ installed: boolean; enabled: boolean }> {
      const state = plugins.get(pluginId);
      if (state === undefined) {
        return { installed: false, enabled: false };
      }
      return {
        installed: true,
        enabled: state.enabled,
      };
    },

    getSchemaComposition(): ComposeResult {
      return schemaRegistry.snapshot();
    },
  };
}

// Backward compatibility aliases
export type PluginSchemaRegistry = SchemaRegistry;
export type PluginPromoteOptions = PromoteOptions;
export type PluginConfigurationLifecycleHooks = ConfigurationLifecycleHooks;
export type PluginConfigurationLifecycleOptions = ConfigurationLifecycleOptions;
export const createPluginConfigurationLifecycleHooks = createConfigurationLifecycleHooks;
export const createInMemoryPluginSchemaRegistry = createInMemorySchemaRegistry;
