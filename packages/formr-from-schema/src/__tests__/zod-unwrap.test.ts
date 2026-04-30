import { describe, expect, test } from "vitest";
import { z } from "zod";
import { extractFromZod } from "../index.js";

describe("ZodEffects unwrapping", () => {
  test("z.string().refine() extracts as string, not unknown", () => {
    const schema = z.object({
      name: z.string().refine((v) => v.length > 0),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "name");
    expect(field).toBeDefined();
    expect(field?.type).toBe("string");
    expect(field?.required).toBe(true);
  });

  test("z.object({...}).refine() still extracts all nested fields", () => {
    const schema = z
      .object({
        email: z.string(),
        confirmEmail: z.string(),
      })
      .refine((data) => data.email === data.confirmEmail);

    const result = extractFromZod(schema);
    expect(result.fields.find((f) => f.path === "email")).toBeDefined();
    expect(result.fields.find((f) => f.path === "confirmEmail")).toBeDefined();
    expect(result.fields.find((f) => f.path === "email")?.type).toBe("string");
  });

  test("z.string().transform() extracts the input type", () => {
    const schema = z.object({
      age: z.string().transform(Number),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "age");
    expect(field).toBeDefined();
    expect(field?.type).toBe("string");
  });

  test("z.string().superRefine() extracts as string", () => {
    const schema = z.object({
      code: z.string().superRefine((val, ctx) => {
        if (val.length < 3) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Too short" });
        }
      }),
    });
    const result = extractFromZod(schema);
    expect(result.fields.find((f) => f.path === "code")?.type).toBe("string");
  });
});

describe("ZodNullable semantics", () => {
  test("z.string().nullable() is required: true", () => {
    const schema = z.object({
      name: z.string().nullable(),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "name");
    expect(field).toBeDefined();
    expect(field?.required).toBe(true);
    expect(field?.type).toBe("string");
  });

  test("z.string().optional() is required: false", () => {
    const schema = z.object({
      name: z.string().optional(),
    });
    const result = extractFromZod(schema);
    expect(result.fields.find((f) => f.path === "name")?.required).toBe(false);
  });

  test("z.string().nullable().optional() is required: false", () => {
    const schema = z.object({
      name: z.string().nullable().optional(),
    });
    const result = extractFromZod(schema);
    expect(result.fields.find((f) => f.path === "name")?.required).toBe(false);
  });

  test("z.string().optional().nullable() is required: false", () => {
    const schema = z.object({
      name: z.string().optional().nullable(),
    });
    const result = extractFromZod(schema);
    expect(result.fields.find((f) => f.path === "name")?.required).toBe(false);
  });
});

describe("ZodLazy unwrapping", () => {
  test("extracts fields from lazy schema", () => {
    const schema = z.object({
      name: z.lazy(() => z.string()),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "name");
    expect(field).toBeDefined();
    expect(field?.type).toBe("string");
  });
});

describe("ZodCatch unwrapping", () => {
  test("extracts inner type from catch wrapper", () => {
    const schema = z.object({
      color: z.string().catch("red"),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "color");
    expect(field).toBeDefined();
    expect(field?.type).toBe("string");
  });
});

describe("ZodBranded unwrapping", () => {
  test("extracts inner type from branded schema", () => {
    const schema = z.object({
      id: z.string().brand<"UserId">(),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "id");
    expect(field).toBeDefined();
    expect(field?.type).toBe("string");
  });
});

describe("ZodReadonly unwrapping", () => {
  test("extracts fields from readonly object", () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .readonly();
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "name");
    expect(field).toBeDefined();
    expect(field?.type).toBe("string");
  });
});

describe("ZodDefault semantics", () => {
  test("z.string().default() is required: false", () => {
    const schema = z.object({
      role: z.string().default("user"),
    });
    const result = extractFromZod(schema);
    expect(result.fields.find((f) => f.path === "role")?.required).toBe(false);
  });
});

describe("combined wrappers", () => {
  test("z.string().nullable().refine() extracts correctly", () => {
    const schema = z.object({
      name: z
        .string()
        .nullable()
        .refine((v) => v !== "bad"),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "name");
    expect(field?.type).toBe("string");
    expect(field?.required).toBe(true);
  });

  test("z.string().optional().refine() extracts as not required", () => {
    const schema = z.object({
      name: z
        .string()
        .optional()
        .refine((v) => v !== "bad"),
    });
    const result = extractFromZod(schema);
    const field = result.fields.find((f) => f.path === "name");
    expect(field?.type).toBe("string");
    expect(field?.required).toBe(false);
  });
});
