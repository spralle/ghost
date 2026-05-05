import { describe, expect, test } from "vitest";
import type { ValidationIssue, ValidatorFn } from "@formbar/core";
import type { JsonSchema } from "../adapters/json-schema-types.js";
import { createJsonSchemaValidator } from "../adapters/json-schema-validator.js";

/**
 * Call the sync validator function directly.
 */
function validateSync(validator: ValidatorFn, data: unknown, stage?: string): readonly ValidationIssue[] {
  return validator({ data, uiState: undefined, stage });
}

/**
 * F4: Validation envelope conformance fixtures.
 * Verifies: required fields present, origin metadata correct,
 * ordering stable, dedupe works.
 */

describe("F4: Validation envelope — required fields present", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };
  const validator = createJsonSchemaValidator(schema);

  test("every issue has code, message, severity, stage, path, source", () => {
    const issues = validateSync(validator, {}, "submit");
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(typeof i.code).toBe("string");
      expect(i.code.length).toBeGreaterThan(0);
      expect(typeof i.message).toBe("string");
      expect(i.message.length).toBeGreaterThan(0);
      expect(["error", "warning", "info"]).toContain(i.severity);
      expect(typeof i.stage).toBe("string");
      expect(i.path).toBeDefined();
      expect(i.path.namespace).toBe("data");
      expect(Array.isArray(i.path.segments)).toBe(true);
      expect(i.source).toBeDefined();
      expect(typeof i.source.origin).toBe("string");
      expect(typeof i.source.validatorId).toBe("string");
    }
  });

  test("origin metadata is json-schema-adapter for JSON Schema validator", () => {
    const issues = validateSync(validator, {}, "submit");
    for (const i of issues) {
      expect(i.source.origin).toBe("json-schema-adapter");
      expect(i.source.validatorId).toBe("json-schema-adapter");
    }
  });
});

describe("F4: Validation envelope — ordering stability", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      a: { type: "string" },
      b: { type: "string" },
      c: { type: "string" },
    },
    required: ["a", "b", "c"],
  };
  const validator = createJsonSchemaValidator(schema);

  test("same input produces same issue order across multiple runs", () => {
    const run1 = validateSync(validator, {}, "submit");
    const run2 = validateSync(validator, {}, "submit");
    const run3 = validateSync(validator, {}, "submit");

    const key = (i: ValidationIssue) => `${i.code}:${i.path.segments.join(".")}`;
    expect(run1.map(key)).toEqual(run2.map(key));
    expect(run2.map(key)).toEqual(run3.map(key));
  });
});

describe("F4: Validation envelope — dedupe", () => {
  test("duplicate issues from same validator are naturally deduped", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    const validator = createJsonSchemaValidator(schema);
    const issues = validateSync(validator, {}, "submit");

    const nameRequired = issues.filter((i) => i.code === "REQUIRED" && i.path.segments.includes("name"));
    expect(nameRequired).toHaveLength(1);
  });

  test("type error and required error on same field are distinct", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { age: { type: "number" } },
      required: ["age"],
    };
    const validator = createJsonSchemaValidator(schema);
    const issues = validateSync(validator, { age: "not-a-number" }, "submit");
    const ageCodes = issues.filter((i) => i.path.segments.includes("age")).map((i) => i.code);
    expect(ageCodes).toContain("INVALID_TYPE");
    expect(ageCodes).not.toContain("REQUIRED");
  });
});
