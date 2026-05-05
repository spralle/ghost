import type { ValidationIssue } from "@formbar/core";
import type { JsonSchema } from "@ghost-shell/schema-core";
import { checkType, isObject, makeIssue } from "./utils.js";

/**
 * ADR section 6.4 — Conditional required field resolution.
 *
 * Resolves which fields become required based on:
 * 1. if/then/else schemas
 * 2. dependentRequired
 * 3. oneOf (discriminated unions)
 * 4. Expression-based (stub — wired later)
 */

interface ConditionalRequiredInput {
  readonly schema: JsonSchema;
  readonly data: Record<string, unknown>;
  readonly stage: string | undefined;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Evaluate an if-schema against data by checking type/enum/required constraints.
 * Returns true if data satisfies the if-schema (no violations).
 */
function evaluateIfSchema(ifSchema: JsonSchema, data: Record<string, unknown>): boolean {
  if (ifSchema.required) {
    for (const field of ifSchema.required) {
      if (isEmpty(data[field])) return false;
    }
  }

  if (ifSchema.properties && isObject(data)) {
    for (const [key, rawPropSchema] of Object.entries(ifSchema.properties)) {
      const propSchema = rawPropSchema as JsonSchema;
      const value = data[key];
      if (value === undefined || value === null) continue;

      if (propSchema.enum && !propSchema.enum.includes(value)) {
        return false;
      }
      if (propSchema.type && typeof propSchema.type === "string") {
        if (!checkType(propSchema.type, value)) return false;
      }
    }
  }

  return true;
}

/**
 * Resolve conditional required fields from if/then/else.
 * Evaluates the `if` schema; applies `then` or `else` required fields.
 */
export function resolveIfThenElseRequired(input: ConditionalRequiredInput): readonly ValidationIssue[] {
  const { schema, data, stage } = input;
  if (!schema.if) return [];

  const conditionMet = evaluateIfSchema(schema.if, data);
  const branch = conditionMet ? schema.then : schema.else;
  if (!branch) return [];

  const issues: ValidationIssue[] = [];

  if (branch.required) {
    for (const field of branch.required) {
      if (isEmpty(data[field])) {
        issues.push(
          makeIssue(
            "CONDITIONAL_REQUIRED",
            `Field "${field}" is required (conditional: if/${conditionMet ? "then" : "else"})`,
            [field],
            stage,
            "json-schema-adapter",
          ),
        );
      }
    }
  }

  // Recurse into nested if/then/else within the chosen branch
  if (branch.if) {
    issues.push(...resolveIfThenElseRequired({ schema: branch, data, stage }));
  }

  return issues;
}

/**
 * Resolve conditional required fields from dependentRequired.
 * If field X has a value, fields Y,Z become required.
 */
export function resolveDependentRequired(input: ConditionalRequiredInput): readonly ValidationIssue[] {
  const { schema, data, stage } = input;
  if (!schema.dependentRequired) return [];

  const issues: ValidationIssue[] = [];
  for (const [trigger, deps] of Object.entries(schema.dependentRequired)) {
    if (!isEmpty(data[trigger])) {
      if (!Array.isArray(deps)) continue;
      for (const dep of deps as readonly string[]) {
        if (isEmpty(data[dep])) {
          issues.push(
            makeIssue(
              "DEPENDENT_REQUIRED",
              `Field "${dep}" is required when "${trigger}" is present`,
              [dep],
              stage,
              "json-schema-adapter",
            ),
          );
        }
      }
    }
  }
  return issues;
}

/**
 * Check if a oneOf branch matches data based on property constraints only
 * (enum/type checks on properties), ignoring required fields.
 */
function matchesOneOfBranch(branch: JsonSchema, data: Record<string, unknown>): boolean {
  if (!branch.properties) return false;

  for (const [key, rawPropSchema] of Object.entries(branch.properties)) {
    const propSchema = rawPropSchema as JsonSchema;
    const value = data[key];
    if (value === undefined || value === null) continue;
    if (propSchema.enum && !propSchema.enum.includes(value)) return false;
    if (propSchema.type && typeof propSchema.type === "string") {
      if (!checkType(propSchema.type, value)) return false;
    }
  }
  return true;
}

/**
 * Resolve required fields from oneOf (discriminated unions).
 * Finds the matching branch and applies its required fields.
 */
export function resolveOneOfRequired(input: ConditionalRequiredInput): readonly ValidationIssue[] {
  const { schema, data, stage } = input;
  if (!schema.oneOf || schema.oneOf.length === 0) return [];

  const matchingBranch = schema.oneOf.find((branch) => matchesOneOfBranch(branch, data));
  if (!matchingBranch?.required) return [];

  const issues: ValidationIssue[] = [];
  for (const field of matchingBranch.required) {
    if (isEmpty(data[field])) {
      issues.push(
        makeIssue(
          "ONEOF_REQUIRED",
          `Field "${field}" is required by matching oneOf branch`,
          [field],
          stage,
          "json-schema-adapter",
        ),
      );
    }
  }
  return issues;
}

/**
 * Stub for expression-based conditional requiredness.
 * Returns empty — actual integration happens when expression engine is wired.
 */
export function resolveExpressionRequired(_input: ConditionalRequiredInput): readonly ValidationIssue[] {
  return [];
}

/**
 * Resolve all conditional required fields from a schema and data.
 */
export function resolveAllConditionalRequired(input: ConditionalRequiredInput): readonly ValidationIssue[] {
  return [
    ...resolveIfThenElseRequired(input),
    ...resolveDependentRequired(input),
    ...resolveOneOfRequired(input),
    ...resolveExpressionRequired(input),
  ];
}
