// catalog-to-json-schema.ts — Converts PluginConfigCatalog entries to JSON Schema for the editor.

import type { ComposedSchemaEntry } from "@ghost-shell/config-plugin-runtime";
import type { JsonSchema } from "@ghost-shell/schema-core";

/**
 * Convert a map of composed schema entries (from the catalog) into a
 * JSON Schema object suitable for the PluginSettingsEditor.
 *
 * Each entry's fullyQualifiedKey becomes a property key, and its
 * ConfigurationPropertySchema becomes the property schema.
 */
export function catalogEntriesToJsonSchema(
  entries: ReadonlyMap<string, ComposedSchemaEntry>,
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};

  for (const [key, entry] of entries) {
    // Strip the owner's namespace prefix to get the local property key.
    // Keys are fully-qualified (e.g. "ghost.motion.speed"); the namespace is
    // derived from ownerId via deriveNamespace. We use the ownerId stored on
    // each entry to build the prefix so multi-segment keys like
    // "ghost.editor.font.size" → "font.size" are preserved correctly.
    const prefix = `${entry.ownerId}.`;
    const localKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
    // ConfigurationPropertySchema is structurally compatible with JsonSchema —
    // both are JSON Schema objects. Cast is safe because weaver schema entries
    // use the same JSON Schema subset as the form renderer.
    properties[localKey] = entry.schema as unknown as JsonSchema;
  }

  return {
    type: "object",
    properties,
  };
}
