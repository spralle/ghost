import { describe, expect, test } from "vitest";
import { z } from "zod";
import { extractFromZodV4, ingestSchema, isZodV4Schema } from "../index.js";

describe("isZodV4Schema", () => {
  test("rejects plain objects", () => {
    expect(isZodV4Schema({})).toBe(false);
    expect(isZodV4Schema(null)).toBe(false);
  });

  test("detects mock v4 schema with _zod property", () => {
    const mockV4 = {
      _zod: { def: { type: "string" }, traits: new Set(["string"]) },
      "~standard": { version: 1, vendor: "zod", validate: () => ({ value: "" }) },
    };
    expect(isZodV4Schema(mockV4)).toBe(true);
  });

  test("detects Standard Schema zod without _def.typeName as v4", () => {
    const mockV4 = {
      "~standard": { version: 1, vendor: "zod", validate: () => ({ value: "" }) },
    };
    expect(isZodV4Schema(mockV4)).toBe(true);
  });
});

describe("extractFromZodV4", () => {
  test("returns validation-only result when _zod is missing", () => {
    const mockSchema = {
      "~standard": { version: 1, vendor: "zod", validate: () => ({ value: "" }) },
    };
    const result = extractFromZodV4(mockSchema);
    expect(result.fields).toHaveLength(0);
    expect(result.metadata.validationOnly).toBe(true);
    expect(result.metadata.vendor).toBe("zod4");
  });

  test("extracts fields from mock v4 object schema", () => {
    const mockV4Object = {
      _zod: {
        def: {
          type: "object",
          shape: {
            name: {
              _zod: { def: { type: "string" } },
            },
            age: {
              _zod: { def: { type: "number" } },
            },
          },
        },
      },
    };

    const result = extractFromZodV4(mockV4Object);
    expect(result.fields).toHaveLength(2);

    const nameField = result.fields.find((f) => f.path === "name");
    expect(nameField).toBeDefined();
    expect(nameField?.type).toBe("string");
    expect(nameField?.required).toBe(true);

    const ageField = result.fields.find((f) => f.path === "age");
    expect(ageField).toBeDefined();
    expect(ageField?.type).toBe("number");
  });

  test("handles optional fields in mock v4", () => {
    const mockV4 = {
      _zod: {
        def: {
          type: "object",
          shape: {
            nickname: {
              _zod: {
                def: {
                  type: "optional",
                  innerType: {
                    _zod: { def: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = extractFromZodV4(mockV4);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]?.required).toBe(false);
  });

  test("handles nested objects in mock v4", () => {
    const mockV4 = {
      _zod: {
        def: {
          type: "object",
          shape: {
            address: {
              _zod: {
                def: {
                  type: "object",
                  shape: {
                    street: { _zod: { def: { type: "string" } } },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = extractFromZodV4(mockV4);
    expect(result.fields.some((f) => f.path === "address.street")).toBe(true);
  });

  test("handles array fields in mock v4", () => {
    const mockV4 = {
      _zod: {
        def: {
          type: "object",
          shape: {
            tags: { _zod: { def: { type: "array" } } },
          },
        },
      },
    };

    const result = extractFromZodV4(mockV4);
    const tagsField = result.fields.find((f) => f.path === "tags");
    expect(tagsField).toBeDefined();
    expect(tagsField?.type).toBe("array");
  });
});

describe("ingestSchema routing", () => {
  test("routes v3 Zod schema through v3 extractor", () => {
    const schema = z.object({ name: z.string() });
    const result = ingestSchema(schema);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]?.path).toBe("name");
  });

  test("routes mock v4 schema through v4 extractor", () => {
    const mockV4 = {
      _zod: {
        def: {
          type: "object",
          shape: {
            email: { _zod: { def: { type: "string" } } },
          },
        },
      },
      "~standard": { version: 1, vendor: "zod", validate: () => ({ value: "" }) },
    };

    const result = ingestSchema(mockV4);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]?.path).toBe("email");
  });
});
