import type { SchemaFieldInfo, SchemaFieldMetadata } from "@scheman/core";
import { humanize } from "./humanize.js";
import { inferPriority } from "./priority.js";
import type { CompileTableFieldsOptions, FilterVariant, TableFieldDescriptor, TableFieldOverride } from "./types.js";

/**
 * Compile an array of schema fields into framework-agnostic TableFieldDescriptor[].
 * Pure function — no React, no side effects.
 */
export function compileTableFields(
  fields: readonly SchemaFieldInfo[],
  options?: CompileTableFieldsOptions,
): TableFieldDescriptor[] {
  const filtered = filterFields(fields, options);
  const overrides = (options?.overrides ?? {}) as Record<string, TableFieldOverride>;
  const defaultVisible = options?.defaultVisible ? new Set(options.defaultVisible) : undefined;

  return filtered.map((field, index) => {
    const override = overrides[field.path] as TableFieldOverride | undefined;
    const annotation = readTableAnnotation(field.metadata);
    const derived = deriveFromType(field);

    const label = resolveHeader(field, override, annotation);
    const sortable = resolveSortable(field, override);
    const visible = resolveVisible(field.path, override, annotation, defaultVisible);
    const order = override?.order ?? index;
    const align = override?.align ?? deriveAlign(field.type);
    const searchable = deriveSearchable(field.type);
    const filter = resolveFilter(derived, override, annotation);
    const format = override?.format ?? annotation?.cell ?? derived.cellRenderer;
    const priority = override?.priority ?? inferPriority(field, index);

    const resolvedPinned = override?.pinned ?? annotation?.pinned;

    return {
      field: field.path,
      label,
      type: field.type,
      visible,
      order,
      ...(align !== undefined ? { align } : {}),
      format,
      ...((override?.formatOptions ?? annotation?.cellProps)
        ? { formatOptions: (override?.formatOptions ?? annotation?.cellProps) as Readonly<Record<string, unknown>> }
        : {}),
      sortable,
      searchable,
      priority,
      ...(filter !== undefined ? { filter } : {}),
      ...(derived.filterOptions !== undefined ? { options: derived.filterOptions } : {}),
      ...(field.metadata?.description !== undefined ? { headerTooltip: field.metadata.description } : {}),
      ...(resolvedPinned !== undefined ? { pinned: resolvedPinned } : {}),
      ...(override?.width !== undefined ? { width: override.width } : {}),
      ...(derived.filterMin !== undefined ? { filterMin: derived.filterMin } : {}),
      ...(derived.filterMax !== undefined ? { filterMax: derived.filterMax } : {}),
      ...(override?.minWidth !== undefined ? { minWidth: override.minWidth } : {}),
      ...(override?.wrap !== undefined ? { wrap: override.wrap } : {}),
      ...(override?.cardSlot !== undefined ? { cardSlot: override.cardSlot } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DerivedColumnConfig {
  filterVariant: FilterVariant;
  cellRenderer: string;
  filterOptions?: readonly unknown[] | undefined;
  filterMin?: number | undefined;
  filterMax?: number | undefined;
}

/** Table-specific annotations from metadata.extra.table */
interface TableAnnotation {
  label?: string;
  cell?: string;
  cellProps?: Record<string, unknown>;
  pinned?: "left" | "right" | false;
  sortable?: boolean;
  filterable?: boolean;
  filterVariant?: FilterVariant;
  hidden?: boolean;
}

function filterFields(
  fields: readonly SchemaFieldInfo[],
  options?: CompileTableFieldsOptions,
): readonly SchemaFieldInfo[] {
  let result = fields;
  if (options?.include) {
    const set = new Set(options.include);
    result = result.filter((f) => set.has(f.path));
  }
  if (options?.exclude) {
    const set = new Set(options.exclude);
    result = result.filter((f) => !set.has(f.path));
  }
  return result;
}

function readTableAnnotation(metadata: SchemaFieldMetadata | undefined): TableAnnotation | undefined {
  const extra = metadata?.extra;
  if (!extra || typeof extra !== "object") return undefined;
  const table = (extra as Record<string, unknown>)["table"];
  if (!table || typeof table !== "object") return undefined;
  return table as TableAnnotation;
}

function deriveFromType(field: SchemaFieldInfo): DerivedColumnConfig {
  const meta = field.metadata;
  const format = meta?.format;

  switch (field.type) {
    case "string":
      if (format === "email" || format === "url") {
        return { filterVariant: "text", cellRenderer: "link" };
      }
      return { filterVariant: "text", cellRenderer: "text" };

    case "enum":
      return deriveEnum(meta);

    case "number":
    case "integer":
      return deriveNumber(meta);

    case "boolean":
      return { filterVariant: "boolean", cellRenderer: "boolean" };

    case "date":
      return { filterVariant: "date", cellRenderer: "date" };

    case "datetime":
      return { filterVariant: "date", cellRenderer: "datetime" };

    case "array":
      return { filterVariant: "multiSelect", cellRenderer: "tags" };

    default:
      return { filterVariant: "text", cellRenderer: "text" };
  }
}

function deriveEnum(meta: SchemaFieldMetadata | undefined): DerivedColumnConfig {
  const options = meta?.enum;
  const cellRenderer = options && options.length <= 8 ? "badge" : "text";
  return {
    filterVariant: "select",
    cellRenderer,
    filterOptions: options,
  };
}

function deriveNumber(meta: SchemaFieldMetadata | undefined): DerivedColumnConfig {
  const hasRange = meta?.minimum != null && meta?.maximum != null;
  if (hasRange) {
    return {
      filterVariant: "range",
      cellRenderer: "text",
      filterMin: meta!.minimum,
      filterMax: meta!.maximum,
    };
  }
  return { filterVariant: "number", cellRenderer: "text" };
}

function deriveAlign(type: string): "left" | "center" | "right" | undefined {
  if (type === "number" || type === "integer") return "right";
  if (type === "boolean") return "center";
  return undefined;
}

function deriveSearchable(type: string): boolean {
  return type === "string" || type === "enum";
}

function resolveHeader(
  field: SchemaFieldInfo,
  override: TableFieldOverride | undefined,
  annotation: TableAnnotation | undefined,
): string {
  return override?.label ?? annotation?.label ?? field.metadata?.label ?? field.metadata?.title ?? humanize(field.path);
}

function resolveSortable(field: SchemaFieldInfo, override: TableFieldOverride | undefined): boolean {
  if (override?.sortable != null) return override.sortable;
  if (field.type === "array" || field.type === "object") return false;
  return true;
}

function resolveVisible(
  path: string,
  override: TableFieldOverride | undefined,
  annotation: TableAnnotation | undefined,
  defaultVisible: Set<string> | undefined,
): boolean {
  if (override?.hidden === true) return false;
  if (annotation?.hidden === true) return false;
  if (defaultVisible) return defaultVisible.has(path);
  return true;
}

function resolveFilter(
  derived: DerivedColumnConfig,
  override: TableFieldOverride | undefined,
  annotation: TableAnnotation | undefined,
): FilterVariant | undefined {
  if (override?.filterable === false) return undefined;
  if (annotation?.filterable === false) return undefined;
  return override?.filterVariant ?? annotation?.filterVariant ?? derived.filterVariant;
}
