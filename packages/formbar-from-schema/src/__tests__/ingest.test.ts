import { describe, expect, test } from "vitest";
import { z } from "zod";
import { extractFromZodV4, ingestSchema, isStandardSchema, isZodSchema, SchemaError } from "../index.js";

describe("isStandardSchema", () => {
  test("detects Zod schema as Standard Schema", () => {
    const schema = z.object({ name: z.string() });
    expect(isStandardSchema(schema)).toBe(true);
  });

  test("rejects non-schema objects", () => {
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema(null)).toBe(false);
    expect(isStandardSchema("string")).toBe(false);
  });
});

describe("isZodSchema", () => {
  test("identifies Zod vendor", () => {
    const schema = z.object({ name: z.string() });
    if (isStandardSchema(schema)) {
      expect(isZodSchema(schema)).toBe(true);
    }
  });
});

describe("extractFromZodV4", () => {
  test("extracts fields from simple object schema", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string(),
      age: z.number(),
    });

    const result = extractFromZodV4(schema);
    expect(result.fields).toHaveLength(3);

    const nameField = result.fields.find((f) => f.path === "name");
    expect(nameField).toBeDefined();
    expect(nameField?.type).toBe("string");
    expect(nameField?.required).toBe(true);

    const ageField = result.fields.find((f) => f.path === "age");
    expect(ageField).toBeDefined();
    expect(ageField?.type).toBe("number");
  });

  test("marks optional fields as not required", () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    });

    const result = extractFromZodV4(schema);
    const nickField = result.fields.find((f) => f.path === "nickname");
    expect(nickField).toBeDefined();
    expect(nickField?.required).toBe(false);
  });

  test("extracts nested object fields with dot paths", () => {
    const schema = z.object({
      customer: z.object({
        name: z.string(),
        email: z.string(),
      }),
    });

    const result = extractFromZodV4(schema);
    expect(result.fields.some((f) => f.path === "customer.name")).toBe(true);
    expect(result.fields.some((f) => f.path === "customer.email")).toBe(true);
  });

  test("handles array fields", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });

    const result = extractFromZodV4(schema);
    const tagsField = result.fields.find((f) => f.path === "tags");
    expect(tagsField).toBeDefined();
    expect(tagsField?.type).toBe("array");
  });

  test("handles boolean fields", () => {
    const schema = z.object({
      active: z.boolean(),
    });

    const result = extractFromZodV4(schema);
    const field = result.fields.find((f) => f.path === "active");
    expect(field).toBeDefined();
    expect(field?.type).toBe("boolean");
  });
});

describe("ingestSchema", () => {
  test("works with Zod schemas", () => {
    const schema = z.object({ name: z.string() });
    const result = ingestSchema(schema);
    expect(result.fields).toHaveLength(1);
  });

  test("rejects non-Standard-Schema", () => {
    expect(() => ingestSchema({})).toThrow(SchemaError);
  });
});
