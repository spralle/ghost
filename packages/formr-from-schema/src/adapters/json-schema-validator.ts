import type { ValidationIssue, ValidatorFn } from "@ghost-shell/formr-core";
import { dereferenceSchema, type JsonSchema } from "@scheman/core";
import { checkType, isObject, makeIssue as makeIssueBase } from "../utils.js";

const ADAPTER_ORIGIN = "json-schema-adapter" as const;

function makeIssue(
  code: string,
  message: string,
  segments: readonly (string | number)[],
  stage: string | undefined,
): ValidationIssue {
  return makeIssueBase(code, message, segments, stage, ADAPTER_ORIGIN);
}

/** Detect if an unknown value looks like a JSON Schema object */
export function isJsonSchema(value: unknown): value is JsonSchema {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;

  const hasSchemaMarker = "$schema" in obj;
  const hasProperties = "properties" in obj && typeof obj["properties"] === "object";
  const hasItems = "items" in obj && typeof obj["items"] === "object";
  const hasEnum = "enum" in obj && Array.isArray(obj["enum"]);
  const hasType = "type" in obj && (typeof obj["type"] === "string" || Array.isArray(obj["type"]));

  if (hasSchemaMarker) return true;
  if (hasProperties) return true;
  if (hasItems) return true;
  if (hasEnum) return true;
  if (hasType && typeof obj["type"] === "string") {
    const knownTypes = ["string", "number", "integer", "boolean", "object", "array", "null"];
    if (knownTypes.includes(obj["type"] as string)) return true;
  }
  if (hasType && Array.isArray(obj["type"])) return true;

  return false;
}

export function createJsonSchemaValidator(rawSchema: JsonSchema): ValidatorFn {
  const schema = dereferenceSchema(rawSchema);
  return (input) => {
    const issues: ValidationIssue[] = [];
    validateNode(schema, input.data, [], input.stage, issues);
    return issues;
  };
}

function validateNode(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (data === undefined || data === null) {
    // Required checks happen at parent level
    return;
  }

  validateType(schema, data, segments, stage, issues);
  validateConst(schema, data, segments, stage, issues);
  validateEnum(schema, data, segments, stage, issues);
  validateConstraints(schema, data, segments, stage, issues);
  validateConditional(schema, data, segments, stage, issues);
  validateDependentRequired(schema, data, segments, stage, issues);

  if (isObject(data)) {
    if (schema.required) {
      validateRequiredFields(schema, data, segments, stage, issues);
    }
    if (schema.properties) {
      validateObjectProperties(schema, data, segments, stage, issues);
    }
  }
}

function validateType(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!schema.type) return;

  if (Array.isArray(schema.type)) {
    validateArrayType(schema.type as readonly string[], data, segments, stage, issues);
    return;
  }

  const type = schema.type as string;
  const valid = checkType(type, data);
  if (!valid) {
    issues.push(makeIssue("INVALID_TYPE", `Expected type "${type}"`, segments, stage));
  }
}

function validateArrayType(
  types: readonly string[],
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (data === null && types.includes("null")) return;
  const matched = types.some((t) => checkType(t, data));
  if (!matched) {
    issues.push(makeIssue("INVALID_TYPE", `Expected one of types: ${types.join(", ")}`, segments, stage));
  }
}

function validateEnum(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!schema.enum) return;
  if (!schema.enum.includes(data)) {
    issues.push(makeIssue("INVALID_ENUM", `Value must be one of: ${schema.enum.join(", ")}`, segments, stage));
  }
}

function validateConst(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (schema.const === undefined) return;
  if (!deepEqual(schema.const, data)) {
    issues.push(makeIssue("INVALID_CONST", `Value must equal: ${JSON.stringify(schema.const)}`, segments, stage));
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}

function validateConstraints(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (typeof data === "number") {
    validateNumericConstraints(schema, data, segments, stage, issues);
  }
  if (typeof data === "string") {
    validateStringConstraints(schema, data, segments, stage, issues);
  }
}

function validateNumericConstraints(
  schema: JsonSchema,
  value: number,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    issues.push(makeIssue("TOO_SMALL", `Value must be >= ${schema.minimum}`, segments, stage));
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    issues.push(makeIssue("TOO_LARGE", `Value must be <= ${schema.maximum}`, segments, stage));
  }
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    issues.push(makeIssue("TOO_SMALL", `Value must be > ${schema.exclusiveMinimum}`, segments, stage));
  }
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    issues.push(makeIssue("TOO_LARGE", `Value must be < ${schema.exclusiveMaximum}`, segments, stage));
  }
}

function validateStringConstraints(
  schema: JsonSchema,
  value: string,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    issues.push(makeIssue("TOO_SHORT", `String must be at least ${schema.minLength} characters`, segments, stage));
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    issues.push(makeIssue("TOO_LONG", `String must be at most ${schema.maxLength} characters`, segments, stage));
  }
  if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
    issues.push(makeIssue("PATTERN_MISMATCH", `String must match pattern: ${schema.pattern}`, segments, stage));
  }
}

/** JSON Schema required only checks key presence, not value emptiness */
function validateRequiredFields(
  schema: JsonSchema,
  data: Record<string, unknown>,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!schema.required) return;
  for (const field of schema.required) {
    if (!(field in data) || data[field] === undefined) {
      issues.push(makeIssue("REQUIRED", `Field "${field}" is required`, [...segments, field], stage));
    }
  }
}

function validateObjectProperties(
  schema: JsonSchema,
  data: Record<string, unknown>,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!schema.properties) return;
  for (const [key, childSchema] of Object.entries(schema.properties)) {
    if (data[key] !== undefined && data[key] !== null) {
      validateNode(childSchema, data[key], [...segments, key], stage, issues);
    }
  }
}

function validateConditional(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!schema.if) return;

  const testIssues: ValidationIssue[] = [];
  validateNode(schema.if, data, segments, stage, testIssues);
  const conditionMet = testIssues.length === 0;

  if (conditionMet && schema.then) {
    validateNode(schema.then, data, segments, stage, issues);
  } else if (!conditionMet && schema.else) {
    validateNode(schema.else, data, segments, stage, issues);
  }
}

function validateDependentRequired(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!schema.dependentRequired || !isObject(data)) return;

  for (const [trigger, deps] of Object.entries(schema.dependentRequired)) {
    if (trigger in data && data[trigger] !== undefined) {
      if (!Array.isArray(deps)) continue;
      for (const dep of deps as readonly string[]) {
        if (!(dep in data) || data[dep] === undefined) {
          issues.push(
            makeIssue(
              "DEPENDENT_REQUIRED",
              `Field "${dep}" is required when "${trigger}" is present`,
              [...segments, dep],
              stage,
            ),
          );
        }
      }
    }
  }
}

function validateFormatDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validateFormatDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

export { validateFormatDate, validateFormatDateTime };
