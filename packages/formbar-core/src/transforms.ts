// ADR section 10 — Three transform phases

import type { DeepKeys, DeepValue } from "./type-utils.js";

export type TransformPhase = "ingress" | "field" | "egress";

export interface TransformDefinition<TData = unknown> {
  readonly id: string;
  readonly phase: TransformPhase;
  readonly path?: string;
  transform(value: unknown, context: TransformContext<TData>): unknown;
}

export interface TransformContext<_TData = unknown> {
  readonly phase: TransformPhase;
  readonly path?: string;
  readonly state: unknown;
}

/**
 * Executes transform definitions for a specific phase, optionally filtered by path.
 * Transforms are applied sequentially in array order.
 *
 * @param transforms - Array of transform definitions to evaluate.
 * @param phase - Which phase to run: `"ingress"`, `"field"`, or `"egress"`.
 * @param value - The input value to transform.
 * @param context - Transform context (current state, optional path).
 * @returns The transformed value after all matching transforms have been applied.
 */
export function runTransforms(
  transforms: readonly TransformDefinition[],
  phase: TransformPhase,
  value: unknown,
  context: Omit<TransformContext, "phase">,
): unknown {
  let result = value;
  for (const t of transforms) {
    if (t.phase !== phase) continue;
    if (t.path && t.path !== context.path) continue;
    result = t.transform(result, { ...context, phase });
  }
  return result;
}

/** Built-in: Date objects → ISO string for canonical storage. */
export function createDateTransform(): TransformDefinition {
  return {
    id: "formbar:date-transform",
    phase: "field",
    transform(value: unknown): unknown {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
  };
}

/** Built-in: ISO date strings pass through unchanged in egress. */
export function createDateEgressTransform(): TransformDefinition {
  return {
    id: "formbar:date-egress-transform",
    phase: "egress",
    transform(value: unknown): unknown {
      return value;
    },
  };
}

/** Output format for configurable date egress transform */
export type DateEgressFormat = "iso" | "timestamp" | "custom";

export interface DateEgressOptions {
  /** Output format: 'iso' (default), 'timestamp' (Unix ms), or 'custom' */
  readonly format?: DateEgressFormat;
  /** Custom formatter — required when format is 'custom' */
  readonly formatter?: (date: Date) => unknown;
  /** Field paths to transform. If omitted, transforms all Date-like values. */
  readonly paths?: readonly string[];
}

/** Configurable date egress transform — converts ISO date strings to desired output format */
export function createConfigurableDateEgressTransform(options?: DateEgressOptions): TransformDefinition {
  const format = options?.format ?? "iso";
  const targetPaths = options?.paths ? new Set(options.paths) : undefined;

  return {
    id: "formbar:configurable-date-egress",
    phase: "egress",
    transform(value: unknown, context: TransformContext): unknown {
      if (targetPaths && context.path && !targetPaths.has(context.path)) {
        return value;
      }
      return transformDateValue(value, format, options?.formatter);
    },
  };
}

function transformDateValue(value: unknown, format: DateEgressFormat, formatter?: (date: Date) => unknown): unknown {
  if (value instanceof Date) {
    return applyDateFormat(value, format, formatter);
  }
  if (typeof value === "string" && isIsoDateString(value)) {
    return applyDateFormat(new Date(value), format, formatter);
  }
  return value;
}

function applyDateFormat(date: Date, format: DateEgressFormat, formatter?: (date: Date) => unknown): unknown {
  switch (format) {
    case "iso":
      return date.toISOString();
    case "timestamp":
      return date.getTime();
    case "custom":
      if (!formatter) return date.toISOString();
      return formatter(date);
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function isIsoDateString(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

/**
 * Creates a type-safe field transform bound to a specific path.
 * The value type is narrowed at compile time based on the path.
 *
 * @param id - Unique identifier for this transform.
 * @param path - The field path this transform applies to.
 * @param phase - Transform phase: `"ingress"`, `"field"`, or `"egress"`.
 * @param transform - The transform function with narrowed value type.
 * @returns A {@link TransformDefinition} ready to pass to form options.
 *
 * @example
 * ```typescript
 * const trimName = createFieldTransform<MyForm, "name">(
 *   "trim-name", "name", "ingress",
 *   (value) => value.trim(),
 * );
 * ```
 */
export function createFieldTransform<TData, P extends string & DeepKeys<TData>>(
  id: string,
  path: P,
  phase: TransformPhase,
  transform: (value: DeepValue<TData, P>, context: TransformContext<TData>) => DeepValue<TData, P>,
): TransformDefinition<TData> {
  return {
    id,
    phase,
    path,
    // Justified: generic narrows at compile time, runtime value is the same shape
    transform: transform as (value: unknown, context: TransformContext<TData>) => unknown,
  };
}
