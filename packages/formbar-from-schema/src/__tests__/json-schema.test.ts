import type { JsonSchema } from "@ghost-shell/schema-core";
import { extractFromJsonSchema, ingestSchema } from "@ghost-shell/schema-core";
import { describe, expect, test } from "vitest";
import { createJsonSchemaValidator, isJsonSchema } from "../adapters/json-schema-validator.js";

const simpleSchema: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    active: { type: "boolean" },
  },
  required: ["name", "age"],
};

describe("extractFromJsonSchema", () => {
  test("extracts fields from simple object schema", () => {
    const result = extractFromJsonSchema(simpleSchema);
    expect(result.fields).toHaveLength(3);
    expect(result.fields.map((f) => f.path)).toEqual(["name", "age", "active"]);
  });

  test("tracks required vs optional fields", () => {
    const result = extractFromJsonSchema(simpleSchema);
    const nameField = result.fields.find((f) => f.path === "name");
    const activeField = result.fields.find((f) => f.path === "active");
    expect(nameField?.required).toBe(true);
    expect(activeField?.required).toBe(false);
  });

  test("extracts x-formbar annotations", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        email: { type: "string", "x-formbar": { widget: "email-input" } },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0]?.metadata).toEqual({ extensions: { formbar: { widget: "email-input" } } });
  });

  test("handles nested objects with dot paths", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
          required: ["street"],
        },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields.map((f) => f.path)).toEqual(["address.street", "address.city"]);
    expect(result.fields.find((f) => f.path === "address.street")?.required).toBe(true);
  });

  test("handles arrays", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["tags"],
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0]?.type).toBe("array");
    expect(result.fields[0]?.required).toBe(true);
  });

  test("maps types correctly", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        s: { type: "string" },
        n: { type: "number" },
        b: { type: "boolean" },
        o: { type: "object", properties: { x: { type: "string" } } },
        a: { type: "array", items: { type: "string" } },
        d: { type: "string", format: "date" },
        dt: { type: "string", format: "date-time" },
        e: { enum: ["a", "b"] },
      },
    };
    const result = extractFromJsonSchema(schema);
    const typeMap = Object.fromEntries(result.fields.map((f) => [f.path, f.type]));
    expect(typeMap["s"]).toBe("string");
    expect(typeMap["n"]).toBe("number");
    expect(typeMap["b"]).toBe("boolean");
    expect(typeMap["o.x"]).toBe("string");
    expect(typeMap["a"]).toBe("array");
    expect(typeMap["d"]).toBe("date");
    expect(typeMap["dt"]).toBe("datetime");
    expect(typeMap["e"]).toBe("enum");
  });
});

describe("createJsonSchemaValidator", () => {
  const validator = createJsonSchemaValidator(simpleSchema);

  test("missing required field produces error issue", () => {
    const issues = validator({ data: { age: 25 }, uiState: {}, stage: "submit" });
    expect(issues.length).toBeGreaterThan(0);
    const nameIssue = issues.find((i) => i.path.segments.includes("name"));
    expect(nameIssue).toBeDefined();
    expect(nameIssue?.code).toBe("REQUIRED");
    expect(nameIssue?.severity).toBe("error");
  });

  test("wrong type produces error issue", () => {
    const issues = validator({ data: { name: 123, age: 25 }, uiState: {}, stage: "submit" });
    const typeIssue = issues.find((i) => i.path.segments.includes("name") && i.code === "INVALID_TYPE");
    expect(typeIssue).toBeDefined();
  });

  test("enum values checked", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { status: { enum: ["active", "inactive"] } },
      required: ["status"],
    };
    const v = createJsonSchemaValidator(schema);
    const issues = v({ data: { status: "unknown" }, uiState: {}, stage: "draft" });
    expect(issues.find((i) => i.code === "INVALID_ENUM")).toBeDefined();
  });

  test("if/then/else conditional required", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        hasEmail: { type: "boolean" },
        email: { type: "string" },
      },
      if: {
        type: "object",
        properties: { hasEmail: { enum: [true] } },
        required: ["hasEmail"],
      },
      then: {
        required: ["email"],
      },
    };
    const v = createJsonSchemaValidator(schema);
    const issues = v({ data: { hasEmail: true }, uiState: {}, stage: "submit" });
    expect(issues.find((i) => i.code === "REQUIRED" && i.path.segments.includes("email"))).toBeDefined();

    const okIssues = v({ data: { hasEmail: true, email: "a@b.com" }, uiState: {}, stage: "submit" });
    expect(okIssues.find((i) => i.code === "REQUIRED" && i.path.segments.includes("email"))).toBeUndefined();
  });

  test("dependentRequired validation", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        country: { type: "string" },
        state: { type: "string" },
      },
      dependentRequired: { country: ["state"] },
    };
    const v = createJsonSchemaValidator(schema);
    const issues = v({ data: { country: "US" }, uiState: {}, stage: "submit" });
    expect(issues.find((i) => i.code === "DEPENDENT_REQUIRED")).toBeDefined();
  });

  test("passing data produces no issues", () => {
    const issues = validator({ data: { name: "Alice", age: 30 }, uiState: {}, stage: "submit" });
    expect(issues).toHaveLength(0);
  });
});

describe("isJsonSchema", () => {
  test("detects JSON Schema objects", () => {
    expect(isJsonSchema({ type: "object", properties: {} })).toBe(true);
    expect(isJsonSchema({ enum: ["a"] })).toBe(true);
    expect(isJsonSchema(null)).toBe(false);
    expect(isJsonSchema("string")).toBe(false);
  });
});

describe("ingestSchema with JSON Schema", () => {
  test("ingests JSON Schema via ingestSchema", () => {
    const result = ingestSchema(simpleSchema);
    expect(result.fields).toHaveLength(3);
  });
});
