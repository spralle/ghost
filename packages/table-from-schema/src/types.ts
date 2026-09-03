import type { SchemaFieldType, SchemaMetadata } from "@scheman/core";

/** Responsive column visibility tier */
export type ColumnPriority = "essential" | "default" | "optional";

/** Filter variant hints for table fields */
export type FilterVariant = "text" | "number" | "range" | "select" | "multiSelect" | "boolean" | "date";

/** Framework-agnostic table field descriptor */
export interface TableFieldDescriptor {
  /** Dot-path field accessor (e.g. "address.city") */
  readonly field: string;
  /** Human-readable label (from meta or humanized from field path) */
  readonly label: string;
  /** Schema-inferred type */
  readonly type: SchemaFieldType;
  /** Whether visible by default */
  readonly visible: boolean;
  /** Display order (lower = first) */
  readonly order: number;
  /** Column alignment hint */
  readonly align?: "left" | "center" | "right";
  /** Format hint for rendering (e.g. "currency", "date", "badge") */
  readonly format?: string;
  /** Format options from schema meta */
  readonly formatOptions?: Readonly<Record<string, unknown>>;
  /** Whether this field is sortable */
  readonly sortable: boolean;
  /** Whether this field is searchable (full-text) */
  readonly searchable: boolean;
  /** Filter variant if filterable */
  readonly filter?: FilterVariant;
  /** Enum options if applicable */
  readonly options?: readonly unknown[];
  /** Header tooltip from schema description */
  readonly headerTooltip?: string;
  /** Responsive column visibility tier */
  readonly priority: ColumnPriority;
  /** Pinned position */
  readonly pinned?: "left" | "right" | false;
  /** Width hint */
  readonly width?: number | string;
  /** Filter min for range filters */
  readonly filterMin?: number;
  /** Filter max for range filters */
  readonly filterMax?: number;
  /** Minimum width in pixels (column can grow). Used with wrap to prevent too-narrow columns. */
  readonly minWidth?: number;
  /** Allow text wrapping in this column. Default: false (text truncates). */
  readonly wrap?: boolean;
  /** Card view: which dock slot this column renders in */
  readonly cardSlot?: "header" | "leading" | "body" | "trailing" | "footer";
}

/** Info about a filterable field */
export interface FilterableFieldInfo {
  readonly id: string;
  readonly variant: FilterVariant;
  readonly options?: readonly unknown[];
  readonly min?: number;
  readonly max?: number;
}

/** Result from createTableConfig */
export interface TableConfig {
  readonly fields: readonly TableFieldDescriptor[];
  readonly searchableFields: readonly string[];
  readonly filterableFields: readonly FilterableFieldInfo[];
  readonly metadata: SchemaMetadata;
}

/** Per-field overrides provided by consumer */
export interface TableFieldOverride {
  readonly label?: string;
  readonly format?: string;
  readonly formatOptions?: Record<string, unknown>;
  readonly pinned?: "left" | "right" | false;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly filterVariant?: FilterVariant;
  readonly hidden?: boolean;
  readonly width?: number | string;
  readonly align?: "left" | "center" | "right";
  readonly order?: number;
  readonly priority?: ColumnPriority;
  /** Minimum width in pixels (column can grow). Used with wrap to prevent too-narrow columns. */
  readonly minWidth?: number;
  /** Allow text wrapping in this column. Default: false (text truncates). */
  readonly wrap?: boolean;
  /** Card view: which dock slot this column renders in */
  readonly cardSlot?: "header" | "leading" | "body" | "trailing" | "footer";
}

/** Options for compileTableFields */
export interface CompileTableFieldsOptions {
  /** Only include these fields (by path) */
  readonly include?: readonly string[];
  /** Exclude these fields (by path) */
  readonly exclude?: readonly string[];
  /** Fields visible by default (others hidden but toggleable) */
  readonly defaultVisible?: readonly string[];
  /** Per-field overrides keyed by field path */
  readonly overrides?: Readonly<Record<string, TableFieldOverride>>;
}

/** Options for createTableConfig */
export interface CreateTableConfigOptions extends CompileTableFieldsOptions {}
