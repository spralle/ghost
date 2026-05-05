import { describe, expect, test } from "vitest";
import type { JsonSchema } from "@ghost-shell/schema-core";
import { extractFromJsonSchema } from "@ghost-shell/schema-core";

describe("allOf merging", () => {
  test("merges allOf subschemas into parent properties", () => {
    const schema: JsonSchema = {
      type: "object",
      allOf: [
        { properties: { name: { type: "string" } }, required: ["name"] },
        { properties: { age: { type: "number" } }, required: ["age"] },
      ],
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields.map((f) => f.path)).toEqual(["name", "age"]);
    expect(result.fields[0]?.required).toBe(true);
    expect(result.fields[1]?.required).toBe(true);
  });

  test("merges allOf with direct properties", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      allOf: [{ properties: { name: { type: "string" } } }],
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields.map((f) => f.path).sort()).toEqual(["id", "name"]);
  });

  test("handles nested allOf recursively", () => {
    const schema: JsonSchema = {
      type: "object",
      allOf: [
        {
          allOf: [{ properties: { a: { type: "string" } } }, { properties: { b: { type: "number" } } }],
        },
      ],
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields.map((f) => f.path).sort()).toEqual(["a", "b"]);
  });

  test("allOf with $ref subschemas", () => {
    const schema: JsonSchema = {
      $defs: {
        Base: { properties: { id: { type: "string" } }, required: ["id"] },
      },
      type: "object",
      allOf: [{ $ref: "#/$defs/Base" }, { properties: { name: { type: "string" } } }],
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields.map((f) => f.path).sort()).toEqual(["id", "name"]);
    expect(result.fields.find((f) => f.path === "id")?.required).toBe(true);
  });
});

describe("oneOf/anyOf variant extraction", () => {
  test("extracts variant fields from oneOf", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        pet: {
          oneOf: [
            {
              type: "object",
              properties: { type: { type: "string", const: "cat" }, meows: { type: "boolean" } },
              required: ["type"],
            },
            {
              type: "object",
              properties: { type: { type: "string", const: "dog" }, barks: { type: "boolean" } },
              required: ["type"],
            },
          ],
        },
      },
    };
    const result = extractFromJsonSchema(schema);
    const petField = result.fields.find((f) => f.path === "pet");
    expect(petField?.type).toBe("union");
    // Variant fields are extracted
    const paths = result.fields.map((f) => f.path);
    expect(paths).toContain("pet.type");
  });

  test("fields in all variants are required", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        item: {
          anyOf: [
            { type: "object", properties: { id: { type: "string" }, extra: { type: "string" } }, required: ["id"] },
            { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
          ],
        },
      },
    };
    const result = extractFromJsonSchema(schema);
    const idField = result.fields.find((f) => f.path === "item.id");
    const extraField = result.fields.find((f) => f.path === "item.extra");
    expect(idField?.required).toBe(true);
    expect(extraField?.required).toBe(false);
  });
});

describe("if/then/else conditional field extraction", () => {
  test("extracts fields from then/else branches as optional", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        hasEmail: { type: "boolean" },
      },
      if: { properties: { hasEmail: { enum: [true] } }, required: ["hasEmail"] },
      then: {
        type: "object",
        properties: { email: { type: "string" } },
        required: ["email"],
      },
      else: {
        type: "object",
        properties: { phone: { type: "string" } },
      },
    };
    const result = extractFromJsonSchema(schema);
    const emailField = result.fields.find((f) => f.path === "email");
    const phoneField = result.fields.find((f) => f.path === "phone");
    expect(emailField).toBeDefined();
    expect(emailField?.required).toBe(false);
    expect(phoneField).toBeDefined();
    expect(phoneField?.required).toBe(false);
  });
});

describe("metadata extraction — constraints and annotations", () => {
  test("extracts string constraints", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 3, maxLength: 50, pattern: "^[a-z]+$" },
      },
    };
    const result = extractFromJsonSchema(schema);
    const field = result.fields[0];
    expect(field?.metadata?.minLength).toBe(3);
    expect(field?.metadata?.maxLength).toBe(50);
    expect(field?.metadata?.pattern).toBe("^[a-z]+$");
  });

  test("extracts numeric constraints", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        age: { type: "number", minimum: 0, maximum: 150, exclusiveMinimum: -1, exclusiveMaximum: 151 },
      },
    };
    const result = extractFromJsonSchema(schema);
    const field = result.fields[0];
    expect(field?.metadata?.minimum).toBe(0);
    expect(field?.metadata?.maximum).toBe(150);
    expect(field?.metadata?.exclusiveMinimum).toBe(-1);
    expect(field?.metadata?.exclusiveMaximum).toBe(151);
  });

  test("extracts array constraints", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10, uniqueItems: true },
      },
    };
    const result = extractFromJsonSchema(schema);
    const field = result.fields.find((f) => f.path === "tags");
    expect(field?.metadata?.minItems).toBe(1);
    expect(field?.metadata?.maxItems).toBe(10);
    expect(field?.metadata?.uniqueItems).toBe(true);
  });

  test("extracts annotations", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        id: { type: "string", readOnly: true },
        secret: { type: "string", writeOnly: true },
        old: { type: "string", deprecated: true },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields.find((f) => f.path === "id")?.metadata?.readOnly).toBe(true);
    expect(result.fields.find((f) => f.path === "secret")?.metadata?.writeOnly).toBe(true);
    expect(result.fields.find((f) => f.path === "old")?.metadata?.deprecated).toBe(true);
  });

  test("extracts format into metadata", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0]?.metadata?.format).toBe("email");
  });

  test("extracts dependentRequired", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        country: {
          type: "string",
          dependentRequired: { country: ["state"] } as unknown as Record<string, readonly string[]>,
        },
      },
    };
    // dependentRequired is on the field level in this test
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0]?.metadata?.dependentRequired).toBeDefined();
  });
});
