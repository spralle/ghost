import { describe, expect, test } from "vitest";
import type { JsonSchema } from "../adapters/json-schema-types.js";
import {
  resolveAllConditionalRequired,
  resolveDependentRequired,
  resolveExpressionRequired,
  resolveIfThenElseRequired,
  resolveOneOfRequired,
} from "../conditional-required.js";

describe("resolveIfThenElseRequired", () => {
  test("field becomes required when if-condition matches (then branch)", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        hasEmail: { type: "boolean" },
        email: { type: "string" },
      },
      if: {
        properties: { hasEmail: { enum: [true] } },
        required: ["hasEmail"],
      },
      then: { required: ["email"] },
    };
    const issues = resolveIfThenElseRequired({
      schema,
      data: { hasEmail: true },
      stage: "submit",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("CONDITIONAL_REQUIRED");
    expect(issues[0].path.segments).toEqual(["email"]);
    expect(issues[0].source.origin).toBe("json-schema-adapter");
  });

  test("no issues when condition matches and field is present", () => {
    const schema: JsonSchema = {
      type: "object",
      if: {
        properties: { hasEmail: { enum: [true] } },
        required: ["hasEmail"],
      },
      then: { required: ["email"] },
    };
    const issues = resolveIfThenElseRequired({
      schema,
      data: { hasEmail: true, email: "a@b.com" },
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });

  test("else branch required when condition does not match", () => {
    const schema: JsonSchema = {
      type: "object",
      if: {
        properties: { type: { enum: ["business"] } },
        required: ["type"],
      },
      then: { required: ["companyName"] },
      else: { required: ["firstName"] },
    };
    const issues = resolveIfThenElseRequired({
      schema,
      data: { type: "personal" },
      stage: "submit",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].path.segments).toEqual(["firstName"]);
  });

  test("no if schema returns empty", () => {
    const issues = resolveIfThenElseRequired({
      schema: { type: "object" },
      data: {},
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("resolveDependentRequired", () => {
  test("field Y required when X has value", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        country: { type: "string" },
        state: { type: "string" },
      },
      dependentRequired: { country: ["state"] },
    };
    const issues = resolveDependentRequired({
      schema,
      data: { country: "US" },
      stage: "submit",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("DEPENDENT_REQUIRED");
    expect(issues[0].path.segments).toEqual(["state"]);
    expect(issues[0].source.origin).toBe("json-schema-adapter");
  });

  test("no issues when trigger field is absent", () => {
    const schema: JsonSchema = {
      type: "object",
      dependentRequired: { country: ["state"] },
    };
    const issues = resolveDependentRequired({
      schema,
      data: {},
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });

  test("no issues when dependent field is present", () => {
    const schema: JsonSchema = {
      type: "object",
      dependentRequired: { country: ["state"] },
    };
    const issues = resolveDependentRequired({
      schema,
      data: { country: "US", state: "CA" },
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("resolveOneOfRequired", () => {
  test("correct branch required fields enforced", () => {
    const schema: JsonSchema = {
      type: "object",
      oneOf: [
        {
          properties: { type: { enum: ["person"] } },
          required: ["type", "firstName"],
        },
        {
          properties: { type: { enum: ["company"] } },
          required: ["type", "companyName"],
        },
      ],
    };
    const issues = resolveOneOfRequired({
      schema,
      data: { type: "company" },
      stage: "submit",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("ONEOF_REQUIRED");
    expect(issues[0].path.segments).toEqual(["companyName"]);
  });

  test("no issues when matching branch fields are present", () => {
    const schema: JsonSchema = {
      type: "object",
      oneOf: [
        {
          properties: { type: { enum: ["person"] } },
          required: ["type", "firstName"],
        },
      ],
    };
    const issues = resolveOneOfRequired({
      schema,
      data: { type: "person", firstName: "Alice" },
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });

  test("no oneOf returns empty", () => {
    const issues = resolveOneOfRequired({
      schema: { type: "object" },
      data: {},
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });

  test("no matching branch returns empty", () => {
    const schema: JsonSchema = {
      type: "object",
      oneOf: [
        {
          properties: { type: { enum: ["person"] } },
          required: ["type", "firstName"],
        },
      ],
    };
    const issues = resolveOneOfRequired({
      schema,
      data: { type: "unknown" },
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("resolveExpressionRequired", () => {
  test("stub returns empty (not yet wired)", () => {
    const issues = resolveExpressionRequired({
      schema: { type: "object" },
      data: {},
      stage: "submit",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("resolveAllConditionalRequired", () => {
  test("combines all conditional required sources", () => {
    const schema: JsonSchema = {
      type: "object",
      if: {
        properties: { hasEmail: { enum: [true] } },
        required: ["hasEmail"],
      },
      then: { required: ["email"] },
      dependentRequired: { country: ["state"] },
    };
    const issues = resolveAllConditionalRequired({
      schema,
      data: { hasEmail: true, country: "US" },
      stage: "submit",
    });
    expect(issues.length).toBeGreaterThanOrEqual(2);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("CONDITIONAL_REQUIRED");
    expect(codes).toContain("DEPENDENT_REQUIRED");
  });
});
