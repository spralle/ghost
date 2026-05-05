import { describe, expect, test } from "vitest";
import { extractFromZod } from "@scheman/core";

/** Helper to create a mock Zod-like schema */
function _mockZod(typeName: string, extra: Record<string, unknown> = {}) {
  return { _def: { typeName, ...extra } };
}

function mockObject(shape: Record<string, unknown>) {
  return { _def: { typeName: "ZodObject", shape } };
}

describe("Zod extractor — constraints and metadata", () => {
  test("extracts description from .describe()", () => {
    const schema = mockObject({
      name: { _def: { typeName: "ZodString", description: "User name", checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.metadata?.description).toBe("User name");
  });

  test("extracts min/max checks", () => {
    const schema = mockObject({
      name: {
        _def: {
          typeName: "ZodString",
          checks: [
            { kind: "min", value: 3 },
            { kind: "max", value: 50 },
          ],
        },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.metadata?.minLength).toBe(3);
    expect(result.fields[0]?.metadata?.maxLength).toBe(50);
  });

  test("extracts regex check as pattern", () => {
    const schema = mockObject({
      code: {
        _def: {
          typeName: "ZodString",
          checks: [{ kind: "regex", regex: /^[A-Z]+$/ }],
        },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.metadata?.pattern).toBe("/^[A-Z]+$/");
  });

  test("extracts email format from checks", () => {
    const schema = mockObject({
      email: {
        _def: { typeName: "ZodString", checks: [{ kind: "email" }] },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.metadata?.format).toBe("email");
  });

  test("extracts default value from ZodDefault", () => {
    const schema = mockObject({
      status: {
        _def: {
          typeName: "ZodDefault",
          innerType: { _def: { typeName: "ZodString", checks: [] } },
          defaultValue: () => "active",
        },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.defaultValue).toBe("active");
  });

  test("extracts enum values from ZodEnum", () => {
    const schema = mockObject({
      role: {
        _def: { typeName: "ZodEnum", values: ["admin", "user", "guest"], checks: [] },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("enum");
    expect(result.fields[0]?.metadata?.enum).toEqual(["admin", "user", "guest"]);
  });

  test("ZodNullable sets nullable metadata", () => {
    const schema = mockObject({
      name: {
        _def: {
          typeName: "ZodNullable",
          innerType: { _def: { typeName: "ZodString", checks: [] } },
        },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.metadata?.nullable).toBe(true);
  });

  test("ZodReadonly sets readOnly metadata", () => {
    const schema = mockObject({
      id: {
        _def: {
          typeName: "ZodReadonly",
          innerType: { _def: { typeName: "ZodString", checks: [] } },
        },
      },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.metadata?.readOnly).toBe(true);
  });

  test("ZodLiteral maps to correct type with const", () => {
    const schema = mockObject({
      status: { _def: { typeName: "ZodLiteral", value: "active", checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("string");
    expect(result.fields[0]?.metadata?.const).toBe("active");
  });

  test("ZodLiteral with number value", () => {
    const schema = mockObject({
      code: { _def: { typeName: "ZodLiteral", value: 42, checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("number");
    expect(result.fields[0]?.metadata?.const).toBe(42);
  });

  test("ZodNativeEnum extracts values", () => {
    const schema = mockObject({
      dir: { _def: { typeName: "ZodNativeEnum", values: { Up: 0, Down: 1 }, checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("enum");
    expect(result.fields[0]?.metadata?.enum).toEqual([0, 1]);
  });

  test("ZodIntersection merges both sides", () => {
    const schema = mockObject({
      merged: {
        _def: {
          typeName: "ZodIntersection",
          left: { _def: { typeName: "ZodObject", shape: { a: { _def: { typeName: "ZodString", checks: [] } } } } },
          right: { _def: { typeName: "ZodObject", shape: { b: { _def: { typeName: "ZodNumber", checks: [] } } } } },
        },
      },
    });
    const result = extractFromZod(schema);
    const paths = result.fields.map((f) => f.path);
    expect(paths).toContain("merged.a");
    expect(paths).toContain("merged.b");
  });

  test("ZodRecord maps to object with additionalProperties", () => {
    const schema = mockObject({
      data: { _def: { typeName: "ZodRecord", checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("object");
    expect(result.fields[0]?.metadata?.additionalProperties).toBe(true);
  });

  test("ZodTuple maps to array with tuple metadata", () => {
    const schema = mockObject({
      pair: { _def: { typeName: "ZodTuple", items: [{}, {}], checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("array");
    expect(result.fields[0]?.metadata?.tuple).toBe(true);
  });

  test("ZodBigInt maps to integer", () => {
    const schema = mockObject({
      big: { _def: { typeName: "ZodBigInt", checks: [] } },
    });
    const result = extractFromZod(schema);
    expect(result.fields[0]?.type).toBe("integer");
  });
});
