import type { CompileTableFieldsOptions, TableFieldDescriptor } from "@ghost-shell/table-from-schema";
import { createTableConfig } from "@ghost-shell/table-from-schema";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import type { EntityTableResult, FilterableColumnInfo } from "./entity-list-types.js";
import { toColumnDefs } from "./to-column-defs.js";

/**
 * Creates the full entity table configuration from a schema.
 * Pure function — no React, no side effects.
 * Mirrors the createSchemaForm pattern from formbar-from-schema.
 */
export function createEntityTable<TData>(
  schema: unknown,
  options?: CompileTableFieldsOptions,
): EntityTableResult<TData> {
  const config = createTableConfig(schema, options);
  const columns = toColumnDefs<TData>(config.fields);

  const defaultColumnVisibility = deriveVisibility(config.fields);
  const defaultSorting: SortingState = [];

  return {
    columns,
    defaultColumnVisibility,
    defaultSorting,
    searchableFields: config.searchableFields as string[],
    filterableColumns: config.filterableFields as FilterableColumnInfo[],
    metadata: config.metadata,
  };
}

/** Build visibility state: hidden fields → false */
function deriveVisibility(fields: readonly TableFieldDescriptor[]): VisibilityState {
  const visibility: VisibilityState = {};
  for (const field of fields) {
    if (!field.visible) {
      visibility[field.field] = false;
    }
  }
  return visibility;
}
