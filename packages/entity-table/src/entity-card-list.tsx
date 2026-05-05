import { ingestSchema } from "@scheman/core";
import type {
  CompileTableFieldsOptions,
  TableFieldDescriptor,
  TableFieldOverride,
} from "@ghost-shell/table-from-schema";
import { compileTableFields } from "@ghost-shell/table-from-schema";
import { cn, Skeleton } from "@ghost-shell/ui";
import { useMemo, useState } from "react";
import type { ZodObject, ZodRawShape } from "zod";

export type CardSlot = "header" | "leading" | "body" | "trailing" | "footer";

export interface CardIndicatorResult {
  color: string;
  edge?: "left" | "right";
  width?: number;
}

export interface EntityCardListProps<TData extends Record<string, unknown>> {
  /** Zod schema for field metadata inference */
  schema: ZodObject<ZodRawShape>;
  /** Data rows to render as cards */
  data: TData[];
  /** Per-field overrides (label, format, priority, cardSlot, etc.) */
  overrides?: Record<string, TableFieldOverride>;
  /** Fields to include */
  include?: string[];
  /** Fields to exclude */
  exclude?: string[];
  /** Row status indicator */
  indicator?: (row: TData) => CardIndicatorResult | null;
  /** Click handler for entire card */
  onClick?: (row: TData) => void;
  /** Explicit slot overrides (alternative to per-field cardSlot in overrides) */
  slots?: Record<string, CardSlot>;
  /** Loading state */
  loading?: boolean;
  loadingCount?: number;
  /** Empty message */
  emptyMessage?: string;
  /** Unique row key accessor */
  getRowId?: (row: TData) => string;
}

function inferSlot(field: TableFieldDescriptor, slots?: Record<string, CardSlot>): CardSlot | "optional" {
  if (slots?.[field.field]) return slots[field.field];
  if (field.cardSlot) return field.cardSlot;

  if (field.priority === "optional") return "optional";
  if (field.priority === "essential") return "header";

  if (field.format === "avatar") return "leading";
  if (field.format === "currency") return "trailing";
  if (field.format === "tags" || field.format === "badge") return "footer";

  return "body";
}

function formatValue(value: unknown, field: TableFieldDescriptor): string {
  if (value == null) return "—";
  if (value instanceof Date)
    return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.format === "currency" && typeof value === "number") {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function partitionFields(fields: TableFieldDescriptor[], slots?: Record<string, CardSlot>) {
  const result: Record<CardSlot | "optional", TableFieldDescriptor[]> = {
    header: [],
    leading: [],
    body: [],
    trailing: [],
    footer: [],
    optional: [],
  };
  for (const field of fields) {
    const slot = inferSlot(field, slots);
    result[slot].push(field);
  }
  return result;
}

function getFieldValue(row: Record<string, unknown>, field: string): unknown {
  const parts = field.split(".");
  let current: unknown = row;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Renders the leading slot (avatars, icons)
function CardLeadingSlot<TData extends Record<string, unknown>>({
  fields,
  row,
}: {
  fields: TableFieldDescriptor[];
  row: TData;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="flex shrink-0 items-start">
      {fields.map((field) => (
        <div key={field.field} className="text-sm">
          {formatValue(getFieldValue(row, field.field), field)}
        </div>
      ))}
    </div>
  );
}

// Renders header + body in the center
function CardCenterSlot<TData extends Record<string, unknown>>({
  header,
  body,
  row,
}: {
  header: TableFieldDescriptor[];
  body: TableFieldDescriptor[];
  row: TData;
}) {
  return (
    <div className="min-w-0 flex-1">
      {header.length > 0 && (
        <div className="space-y-0.5">
          {header.map((field, i) => (
            <div
              key={field.field}
              className={cn(i === 0 ? "text-base font-semibold leading-tight" : "text-sm text-muted-foreground")}
            >
              {formatValue(getFieldValue(row, field.field), field)}
            </div>
          ))}
        </div>
      )}
      {body.length > 0 && (
        <div className={cn("grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2", header.length > 0 && "mt-2")}>
          {body.map((field) => (
            <div key={field.field} className="flex items-baseline gap-1.5 text-sm">
              <span className="text-muted-foreground shrink-0 text-xs">{field.label}</span>
              <span className="truncate">{formatValue(getFieldValue(row, field.field), field)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Renders the trailing slot (money, status)
function CardTrailingSlot<TData extends Record<string, unknown>>({
  fields,
  row,
}: {
  fields: TableFieldDescriptor[];
  row: TData;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-col items-end justify-start gap-1">
      {fields.map((field) => (
        <div key={field.field} className="text-right text-sm font-medium">
          {formatValue(getFieldValue(row, field.field), field)}
        </div>
      ))}
    </div>
  );
}

// Renders the footer slot
function CardFooterSlot<TData extends Record<string, unknown>>({
  fields,
  row,
}: {
  fields: TableFieldDescriptor[];
  row: TData;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
      {fields.map((field) => (
        <div key={field.field}>{formatValue(getFieldValue(row, field.field), field)}</div>
      ))}
    </div>
  );
}

// Renders expandable optional fields
function CardOptionalSlot<TData extends Record<string, unknown>>({
  fields,
  row,
  expanded,
  onToggle,
}: {
  fields: TableFieldDescriptor[];
  row: TData;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-2">
      {expanded && (
        <div className="mb-2 grid grid-cols-1 gap-x-4 gap-y-1 border-t pt-2 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.field} className="flex items-baseline gap-1.5 text-sm">
              <span className="text-muted-foreground shrink-0 text-xs">{field.label}</span>
              <span className="truncate">{formatValue(getFieldValue(row, field.field), field)}</span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
      >
        {expanded ? "Show less" : `Show ${fields.length} more`}
      </button>
    </div>
  );
}

function EntityCardItem<TData extends Record<string, unknown>>({
  row,
  slotGroups,
  indicator,
  onClick,
}: {
  row: TData;
  slotGroups: Record<CardSlot | "optional", TableFieldDescriptor[]>;
  indicator?: CardIndicatorResult | null;
  onClick?: (row: TData) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: card click handler with tabIndex for keyboard access
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card text-card-foreground",
        onClick && "cursor-pointer hover:border-primary/50 transition-colors",
      )}
      onClick={onClick ? () => onClick(row) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") onClick(row);
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {indicator && (
        <div
          className={cn("absolute top-0 bottom-0", indicator.edge === "right" ? "right-0" : "left-0")}
          style={{ width: `${indicator.width ?? 4}px`, backgroundColor: indicator.color }}
        />
      )}

      <div
        className={cn(
          "p-4",
          indicator && indicator.edge !== "right" && "pl-5",
          indicator && indicator.edge === "right" && "pr-5",
        )}
      >
        <div className="flex gap-3">
          <CardLeadingSlot fields={slotGroups.leading} row={row} />
          <CardCenterSlot header={slotGroups.header} body={slotGroups.body} row={row} />
          <CardTrailingSlot fields={slotGroups.trailing} row={row} />
        </div>
        <CardFooterSlot fields={slotGroups.footer} row={row} />
        <CardOptionalSlot
          fields={slotGroups.optional}
          row={row}
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
        />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

export function EntityCardList<TData extends Record<string, unknown>>({
  schema,
  data,
  overrides,
  include,
  exclude,
  indicator,
  onClick,
  slots,
  loading = false,
  loadingCount = 5,
  emptyMessage = "No results.",
  getRowId,
}: EntityCardListProps<TData>) {
  const fields = useMemo(() => {
    const { fields: schemaFields } = ingestSchema(schema);
    const compiled = compileTableFields(schemaFields, { include, exclude, overrides } as CompileTableFieldsOptions);
    return compiled.filter((f) => f.visible);
  }, [schema, include, exclude, overrides]);

  const slotGroups = useMemo(() => partitionFields(fields, slots), [fields, slots]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: loadingCount }).map((_, i) => (
          <CardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((row, i) => (
        <EntityCardItem
          key={getRowId ? getRowId(row) : i}
          row={row}
          slotGroups={slotGroups}
          indicator={indicator?.(row)}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
