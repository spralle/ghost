import type { ValidatorFn } from "./contracts.js";
import { FormbarError } from "./errors.js";
import type { ValidationIssue } from "./state.js";

/**
 * Minimal duck-type interface matching Standard Schema v1.
 * Defined here to avoid dependency on formbar-from-schema.
 * See: https://github.com/standard-schema/standard-schema
 */
export interface StandardSchemaLike {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaResultLike | Promise<StandardSchemaResultLike>;
  };
}

interface StandardSchemaResultLike {
  readonly value?: unknown;
  readonly issues?: readonly StandardSchemaIssueLike[];
}

interface StandardSchemaIssueLike {
  readonly message: string;
  readonly path?: readonly (string | number | symbol)[];
}

/** Duck-type check: does this value look like a Standard Schema v1 object? */
export function isStandardSchemaLike(value: unknown): value is StandardSchemaLike {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!("~standard" in obj)) return false;
  const std = obj["~standard"];
  if (typeof std !== "object" || std === null) return false;
  const stdObj = std as Record<string, unknown>;
  return typeof stdObj["validate"] === "function" && stdObj["version"] === 1;
}

/** Wraps a Standard Schema object as a formbar ValidatorFn. */
export function createStandardSchemaValidator(schema: StandardSchemaLike): ValidatorFn {
  const vendor = schema["~standard"].vendor;
  return (input) => {
    const result = schema["~standard"].validate(input.data);
    if (result instanceof Promise) {
      throw new FormbarError(
        "FORMBAR_ASYNC_SCHEMA_IN_SYNC",
        `Standard Schema vendor "${vendor}" returned a Promise from validate(). ` +
          "Use asyncValidators for async schema validation.",
      );
    }
    if (!result.issues || result.issues.length === 0) return [];
    return result.issues.map((issue): ValidationIssue => {
      const segments = issue.path ? issue.path.map((seg) => String(seg)) : [];
      return {
        code: "SCHEMA_VALIDATION",
        message: issue.message,
        severity: "error",
        path: { namespace: "data", segments },
        source: { origin: "standard-schema", validatorId: `standard-schema:${vendor}` },
      };
    });
  };
}
