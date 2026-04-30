import { describe, expect, it } from "vitest";

import { FromSchemaError } from "../errors.js";
import { hasUiPaths, isValidUiSchema, validateUiSchemaRequirement } from "../ui-schema-check.js";

describe("validateUiSchemaRequirement", () => {
  it("allows no $ui paths and no uiStateSchema", () => {
    expect(() => validateUiSchemaRequirement({ hasUiPathReferences: false })).not.toThrow();
  });

  it("allows no $ui paths with uiStateSchema provided", () => {
    expect(() =>
      validateUiSchemaRequirement({
        hasUiPathReferences: false,
        uiStateSchema: { type: "object" },
      }),
    ).not.toThrow();
  });

  it("allows $ui paths when uiStateSchema is provided", () => {
    expect(() =>
      validateUiSchemaRequirement({
        hasUiPathReferences: true,
        uiStateSchema: { type: "object" },
      }),
    ).not.toThrow();
  });

  it("throws FORMR_UI_SCHEMA_REQUIRED when $ui paths present without uiStateSchema", () => {
    expect(() => validateUiSchemaRequirement({ hasUiPathReferences: true })).toThrow(FromSchemaError);

    try {
      validateUiSchemaRequirement({ hasUiPathReferences: true });
    } catch (e) {
      expect((e as FromSchemaError).code).toBe("FORMR_UI_SCHEMA_REQUIRED");
    }
  });
});

describe("hasUiPaths", () => {
  it("detects $ui.visible", () => {
    expect(hasUiPaths(["$ui.visible"])).toBe(true);
  });

  it("detects $ui.field.visible", () => {
    expect(hasUiPaths(["$ui.field.visible"])).toBe(true);
  });

  it("rejects customer.email", () => {
    expect(hasUiPaths(["customer.email"])).toBe(false);
  });

  it("rejects /ui/field (pointer, not $ui)", () => {
    expect(hasUiPaths(["/ui/field"])).toBe(false);
  });

  it("detects bare $ui", () => {
    expect(hasUiPaths(["$ui"])).toBe(true);
  });
});

describe("isValidUiSchema", () => {
  it("accepts Standard Schema v1 object", () => {
    const schema = { "~standard": { version: 1, vendor: "test" } };
    expect(isValidUiSchema(schema)).toBe(true);
  });

  it("accepts JSON Schema with type", () => {
    expect(isValidUiSchema({ type: "object" })).toBe(true);
  });

  it("accepts JSON Schema with properties", () => {
    expect(isValidUiSchema({ properties: { visible: { type: "boolean" } } })).toBe(true);
  });

  it("accepts JSON Schema with $schema", () => {
    expect(isValidUiSchema({ $schema: "http://json-schema.org/draft-07/schema#" })).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidUiSchema(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidUiSchema(undefined)).toBe(false);
  });

  it("rejects string", () => {
    expect(isValidUiSchema("not a schema")).toBe(false);
  });
});
