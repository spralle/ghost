import type { CanonicalPath, ValidationIssue } from "@formbar/core";

export type IssueOrigin = "standard-schema" | "function-validator" | "json-schema-adapter" | "rule" | "middleware";

/** Build a data-namespace CanonicalPath from segments */
export function makePath(segments: readonly (string | number)[]): CanonicalPath {
  return { namespace: "data", segments };
}

/** Create a ValidationIssue with standard structure */
export function makeIssue(
  code: string,
  message: string,
  segments: readonly (string | number)[],
  stage: string | undefined,
  origin: IssueOrigin,
): ValidationIssue {
  return {
    code,
    message,
    severity: "error",
    ...(stage !== undefined ? { stage } : {}),
    path: makePath(segments),
    source: { origin, validatorId: origin },
  };
}

/** Type guard for plain objects (not arrays, not null) */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Runtime type check matching JSON Schema type strings */
export function checkType(type: string, data: unknown): boolean {
  switch (type) {
    case "string":
      return typeof data === "string";
    case "number":
      return typeof data === "number";
    case "integer":
      return typeof data === "number" && Number.isInteger(data);
    case "boolean":
      return typeof data === "boolean";
    case "object":
      return isObject(data);
    case "array":
      return Array.isArray(data);
    case "null":
      return data === null;
    default:
      return true;
  }
}
