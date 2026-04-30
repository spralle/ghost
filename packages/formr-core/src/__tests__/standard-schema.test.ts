import { describe, expect, it } from "vitest";
import { createForm } from "../create-form.js";
import type { StandardSchemaLike } from "../standard-schema.js";
import { createStandardSchemaValidator, isStandardSchemaLike } from "../standard-schema.js";

/** Create a mock Standard Schema that validates synchronously */
function mockStandardSchema(
  validateFn: (data: unknown) => {
    value?: unknown;
    issues?: readonly { message: string; path?: readonly (string | number | symbol)[] }[];
  },
): StandardSchemaLike {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: validateFn,
    },
  };
}

describe("isStandardSchemaLike", () => {
  it("detects valid Standard Schema objects", () => {
    const schema = mockStandardSchema(() => ({ value: {} }));
    expect(isStandardSchemaLike(schema)).toBe(true);
  });

  it("rejects non-schema values", () => {
    expect(isStandardSchemaLike(null)).toBe(false);
    expect(isStandardSchemaLike(42)).toBe(false);
    expect(isStandardSchemaLike({})).toBe(false);
    expect(isStandardSchemaLike({ "~standard": {} })).toBe(false);
    expect(isStandardSchemaLike(() => {})).toBe(false);
  });
});

describe("createStandardSchemaValidator", () => {
  it("returns empty issues for valid data", () => {
    const schema = mockStandardSchema(() => ({ value: {} }));
    const validator = createStandardSchemaValidator(schema);
    const issues = validator({ data: { name: "test" }, uiState: {} });
    expect(issues).toEqual([]);
  });

  it("maps schema issues to ValidationIssue format", () => {
    const schema = mockStandardSchema(() => ({
      issues: [
        { message: "Name required", path: ["name"] },
        { message: "Age too low", path: ["age"] },
      ],
    }));
    const validator = createStandardSchemaValidator(schema);
    const issues = validator({ data: {}, uiState: {} });
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({
      code: "SCHEMA_VALIDATION",
      message: "Name required",
      path: { namespace: "data", segments: ["name"] },
      severity: "error",
      source: { origin: "standard-schema" },
    });
    expect(issues[1]).toMatchObject({ message: "Age too low" });
  });

  it("handles nested paths", () => {
    const schema = mockStandardSchema(() => ({
      issues: [{ message: "Bad", path: ["address", "city"] }],
    }));
    const validator = createStandardSchemaValidator(schema);
    const issues = validator({ data: {}, uiState: {} });
    expect(issues[0]?.path).toEqual({ namespace: "data", segments: ["address", "city"] });
  });

  it("handles issues with no path", () => {
    const schema = mockStandardSchema(() => ({
      issues: [{ message: "Form invalid" }],
    }));
    const validator = createStandardSchemaValidator(schema);
    const issues = validator({ data: {}, uiState: {} });
    expect(issues[0]?.path).toEqual({ namespace: "data", segments: [] });
  });

  it("throws on async validate", () => {
    const schema: StandardSchemaLike = {
      "~standard": {
        version: 1,
        vendor: "async-vendor",
        validate: () => Promise.resolve({ value: {} }),
      },
    };
    const validator = createStandardSchemaValidator(schema);
    expect(() => validator({ data: {}, uiState: {} })).toThrow("async-vendor");
  });
});

describe("createForm with Standard Schema validator", () => {
  it("auto-detects and wraps Standard Schema in validators array", () => {
    const schema = mockStandardSchema((data) => {
      const d = data as Record<string, unknown>;
      if (!d["name"]) return { issues: [{ message: "Name required", path: ["name"] }] };
      return { value: data };
    });

    const form = createForm({
      initialData: { name: "" },
      validators: [schema],
    });

    const issues = form.validate();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.message).toBe("Name required");
  });

  it("works with mixed validators (schema + function)", () => {
    const schema = mockStandardSchema(() => ({ value: {} }));
    const customValidator = () => [
      {
        code: "CUSTOM",
        message: "Custom issue",
        severity: "error" as const,
        path: { namespace: "data" as const, segments: ["field"] },
        source: { origin: "function-validator" as const, validatorId: "custom" },
      },
    ];

    const form = createForm({
      initialData: { name: "" },
      validators: [schema, customValidator],
    });

    const issues = form.validate();
    expect(issues.some((i) => i.code === "CUSTOM")).toBe(true);
  });
});
