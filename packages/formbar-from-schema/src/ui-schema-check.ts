import { FromSchemaError } from "./errors.js";

/** ADR section 4: if a $ui path is referenced, uiStateSchema is required */
export function validateUiSchemaRequirement(config: {
  readonly uiStateSchema?: unknown;
  readonly hasUiPathReferences: boolean;
}): void {
  if (config.hasUiPathReferences && !config.uiStateSchema) {
    throw new FromSchemaError(
      "FORMBAR_UI_SCHEMA_REQUIRED",
      "uiStateSchema is required when a path reference uses $ui namespace. " +
        "Provide uiStateSchema in CreateFormOptions or remove all $ui path references.",
    );
  }
}

/** Detect if paths in a collection reference the $ui namespace */
export function hasUiPaths(paths: readonly string[]): boolean {
  return paths.some((p) => p.startsWith("$ui.") || p === "$ui");
}

/** Check if a uiStateSchema is a Standard Schema or JSON Schema */
export function isValidUiSchema(schema: unknown): boolean {
  if (schema === null || schema === undefined) return false;

  if (typeof schema !== "object") return false;

  const obj = schema as Record<string, unknown>;

  // Standard Schema v1
  if ("~standard" in obj) return true;

  // JSON Schema (has type, properties, or $schema)
  return "type" in obj || "properties" in obj || "$schema" in obj;
}
