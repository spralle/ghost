import { ingestSchema } from "@scheman/core";
import { compileTableFields } from "./compile-table-fields.js";
import type { CreateTableConfigOptions, FilterableFieldInfo, TableConfig } from "./types.js";

/**
 * Creates a framework-agnostic table configuration from a schema.
 * Pure function — no React, no side effects, no browser dependencies.
 */
export function createTableConfig(schema: unknown, options?: CreateTableConfigOptions): TableConfig {
  const { fields, metadata } = ingestSchema(schema);
  const compiled = compileTableFields(fields, options);

  const searchableFields = compiled.filter((f) => f.searchable).map((f) => f.field);

  const filterableFields: FilterableFieldInfo[] = compiled
    .filter((f) => f.filter !== undefined)
    .map((f) => ({
      id: f.field,
      variant: f.filter!,
      ...(f.options !== undefined ? { options: f.options } : {}),
      ...(f.filterMin !== undefined ? { min: f.filterMin } : {}),
      ...(f.filterMax !== undefined ? { max: f.filterMax } : {}),
    }));

  return {
    fields: compiled,
    searchableFields,
    filterableFields,
    metadata,
  };
}
