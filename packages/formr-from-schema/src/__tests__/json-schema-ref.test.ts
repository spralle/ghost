import { describe, expect, test } from "vitest";
import type { JsonSchema } from "@scheman/core";
import { dereferenceSchema, extractFromJsonSchema } from "@scheman/core";
import { createJsonSchemaValidator } from "../adapters/json-schema-validator.js";

describe("dereferenceSchema", () => {
  test("resolves $defs with $ref", () => {
    const schema: JsonSchema = {
      type: "object",
      $defs: {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
          required: ["street"],
        },
      },
      properties: {
        home: { $ref: "#/$defs/Address" },
        work: { $ref: "#/$defs/Address" },
      },
    };

    const result = dereferenceSchema(schema);
    expect(result.properties?.home).toBeDefined();
    expect(result.properties?.home?.properties?.street).toEqual({ type: "string" });
    expect(result.properties?.work?.required).toEqual(["street"]);
  });

  test("resolves nested $ref (ref to ref)", () => {
    const schema: JsonSchema = {
      type: "object",
      $defs: {
        Name: { type: "string" },
        Person: {
          type: "object",
          properties: {
            name: { $ref: "#/$defs/Name" },
          },
        },
      },
      properties: {
        owner: { $ref: "#/$defs/Person" },
      },
    };

    const result = dereferenceSchema(schema);
    expect(result.properties?.owner?.properties?.name).toEqual({ type: "string" });
  });

  test("throws on circular $ref", () => {
    const schema: JsonSchema = {
      type: "object",
      $defs: {
        A: { $ref: "#/$defs/B" },
        B: { $ref: "#/$defs/A" },
      },
      properties: {
        x: { $ref: "#/$defs/A" },
      },
    };

    expect(() => dereferenceSchema(schema)).toThrow(/Circular \$ref/);
  });

  test("resolves definitions (old draft) same as $defs", () => {
    const schema: JsonSchema = {
      type: "object",
      definitions: {
        Color: { type: "string", enum: ["red", "blue"] },
      },
      properties: {
        favorite: { $ref: "#/definitions/Color" },
      },
    };

    const result = dereferenceSchema(schema);
    expect(result.properties?.favorite?.enum).toEqual(["red", "blue"]);
  });

  test("throws on unresolvable $ref", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        x: { $ref: "#/$defs/Missing" },
      },
    };

    expect(() => dereferenceSchema(schema)).toThrow(/Unresolvable \$ref/);
  });

  test("throws on external $ref", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        x: { $ref: "https://example.com/schema.json" },
      },
    };

    expect(() => dereferenceSchema(schema)).toThrow(/Unsupported \$ref format/);
  });
});

describe("extractFromJsonSchema with $ref", () => {
  test("extracts fields from schema with $defs", () => {
    const schema: JsonSchema = {
      type: "object",
      $defs: {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
            zip: { type: "string" },
          },
          required: ["street"],
        },
      },
      properties: {
        billing: { $ref: "#/$defs/Address" },
      },
      required: ["billing"],
    };

    const result = extractFromJsonSchema(schema);
    const paths = result.fields.map((f) => f.path);
    expect(paths).toContain("billing.street");
    expect(paths).toContain("billing.zip");

    const street = result.fields.find((f) => f.path === "billing.street");
    expect(street?.required).toBe(true);
  });
});

describe("const support", () => {
  test("extraction sets defaultValue for const", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        version: { type: "string", const: "2.0" },
      },
    };

    const result = extractFromJsonSchema(schema);
    const version = result.fields.find((f) => f.path === "version");
    expect(version?.defaultValue).toBe("2.0");
  });

  test("validation passes when value matches const", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        kind: { type: "string", const: "user" },
      },
    };

    const validator = createJsonSchemaValidator(schema);
    const issues = validator({ data: { kind: "user" }, uiState: {}, stage: "submit" });
    expect(issues).toHaveLength(0);
  });

  test("validation fails when value does not match const", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        kind: { type: "string", const: "user" },
      },
    };

    const validator = createJsonSchemaValidator(schema);
    const issues = validator({ data: { kind: "admin" }, uiState: {}, stage: "submit" });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("INVALID_CONST");
  });

  test("const with deep object equality", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        config: { const: { a: 1, b: [2, 3] } },
      },
    };

    const validator = createJsonSchemaValidator(schema);
    const pass = validator({ data: { config: { a: 1, b: [2, 3] } }, uiState: {}, stage: "submit" });
    expect(pass).toHaveLength(0);

    const fail = validator({ data: { config: { a: 1, b: [2, 4] } }, uiState: {}, stage: "submit" });
    expect(fail).toHaveLength(1);
  });

  test("oneOf with const discriminator", () => {
    const schema: JsonSchema = {
      type: "object",
      $defs: {
        Cat: {
          type: "object",
          properties: {
            type: { type: "string", const: "cat" },
            purrs: { type: "boolean" },
          },
          required: ["type"],
        },
        Dog: {
          type: "object",
          properties: {
            type: { type: "string", const: "dog" },
            barks: { type: "boolean" },
          },
          required: ["type"],
        },
      },
      properties: {
        pet: {
          oneOf: [{ $ref: "#/$defs/Cat" }, { $ref: "#/$defs/Dog" }],
        },
      },
    };

    const result = extractFromJsonSchema(schema);
    const pet = result.fields.find((f) => f.path === "pet");
    expect(pet?.type).toBe("union");
  });
});
