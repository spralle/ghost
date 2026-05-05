import type { ValidatorFn } from "@ghost-shell/formr-core";
import { createStandardSchemaValidator, isStandardSchemaLike } from "@ghost-shell/formr-core";
import { ingestSchema, type JsonSchema, type SchemaFieldInfo, type SchemaMetadata } from "@scheman/core";
import { createJsonSchemaValidator, isJsonSchema } from "./adapters/json-schema-validator.js";
import { compileLayout } from "./layout/layout-compiler.js";
import type { LayoutNode } from "./layout/layout-types.js";
import { applyLayoutMiddleware, type LayoutMiddleware } from "./layout-middleware.js";

export interface CreateSchemaFormOptions {
  /** Additional validators to include beyond the auto-detected schema validator */
  readonly validators?: readonly ValidatorFn[] | undefined;
  /** Override the auto-compiled layout with a custom LayoutNode tree */
  readonly layoutOverride?: LayoutNode | undefined;
  /** Middleware pipeline applied to the compiled layout tree */
  readonly layoutMiddleware?: readonly LayoutMiddleware[] | undefined;
}

export interface SchemaFormResult {
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
  readonly validators: readonly ValidatorFn[];
  readonly defaults: Readonly<Record<string, unknown>>;
}

/**
 * Pure schema preparation: ingest + compile layout + create validators.
 * Framework-agnostic — use directly or wrap in framework lifecycle (useSchemaForm for React).
 */
export function createSchemaForm(schema: unknown, options?: CreateSchemaFormOptions): SchemaFormResult {
  const result = ingestSchema(schema);
  let layout = options?.layoutOverride ?? compileLayout(result);

  if (options?.layoutMiddleware?.length) {
    const fieldInfoMap = new Map<string, SchemaFieldInfo>(result.fields.map((f: SchemaFieldInfo) => [f.path, f]));
    layout = applyLayoutMiddleware(layout, options.layoutMiddleware, fieldInfoMap);
  }

  const validators: ValidatorFn[] = [];
  if (isJsonSchema(schema)) {
    validators.push(createJsonSchemaValidator(schema as JsonSchema));
  } else if (isStandardSchemaLike(schema)) {
    validators.push(createStandardSchemaValidator(schema));
  }
  if (options?.validators) {
    validators.push(...options.validators);
  }
  const defaults: Record<string, unknown> = {};
  for (const f of result.fields) {
    if (f.defaultValue !== undefined) {
      defaults[f.path] = f.defaultValue;
    }
  }
  return { fields: result.fields, metadata: result.metadata, layout, validators, defaults };
}
