// Primary pipeline

// Re-export schema-core types consumed by downstream packages
export type { SchemaMetadata } from "@scheman/core";
export { compileTableFields } from "./compile-table-fields.js";
export { createTableConfig } from "./create-table-config.js";
// Utility
export { humanize } from "./humanize.js";
export { inferPriority } from "./priority.js";
// Types
export type {
  ColumnPriority,
  CompileTableFieldsOptions,
  CreateTableConfigOptions,
  FilterableFieldInfo,
  FilterVariant,
  TableConfig,
  TableFieldDescriptor,
  TableFieldOverride,
} from "./types.js";
