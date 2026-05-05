import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@ghost-shell/schema-core";
import type { WeaverFormbarContext } from "../schema-middleware.js";
import { weaverToFormbarMiddleware } from "../schema-middleware.js";

function makeContext(overrides?: Partial<WeaverFormbarContext>): WeaverFormbarContext {
  return {
    layer: "user",
    layerRank: 2,
    layerRanks: new Map([
      ["default", 0],
      ["system", 1],
      ["user", 2],
      ["workspace", 3],
    ]),
    authRoles: ["admin", "editor"],
    ...overrides,
  };
}

describe("weaverToFormbarMiddleware", () => {
  it("injects widget: password for sensitive fields", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        apiKey: { type: "string", "x-weaver": { sensitive: true } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext())(schema);
    const prop = result.properties?.["apiKey"];
    expect(prop?.["x-formbar"]).toEqual({ widget: "password" });
  });

  it("injects readOnly when layer rank exceeds maxOverrideLayer ceiling", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        setting: { type: "string", "x-weaver": { maxOverrideLayer: "system" } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext({ layerRank: 2 }))(schema);
    expect(result.properties?.["setting"]?.["x-formbar"]).toEqual({ readOnly: true });
  });

  it("does NOT inject readOnly when layer rank is within ceiling", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        setting: { type: "string", "x-weaver": { maxOverrideLayer: "workspace" } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext({ layerRank: 2 }))(schema);
    expect(result.properties?.["setting"]?.["x-formbar"]).toBeUndefined();
  });

  it("injects readOnly for non-direct changePolicy when no session", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        port: { type: "number", "x-weaver": { changePolicy: "restart-required" } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext({ sessionActive: undefined }))(schema);
    expect(result.properties?.["port"]?.["x-formbar"]).toEqual({ readOnly: true });
  });

  it("does NOT inject readOnly for non-direct changePolicy when session active", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        port: { type: "number", "x-weaver": { changePolicy: "restart-required" } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext({ sessionActive: true }))(schema);
    expect(result.properties?.["port"]?.["x-formbar"]).toBeUndefined();
  });

  it("injects hidden when visibility role not in authRoles", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        secret: { type: "string", "x-weaver": { visibility: "superadmin" } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext({ authRoles: ["editor"] }))(schema);
    expect(result.properties?.["secret"]?.["x-formbar"]).toEqual({ hidden: true });
  });

  it("does NOT inject hidden when visibility role is in authRoles", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        secret: { type: "string", "x-weaver": { visibility: "admin" } },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext({ authRoles: ["admin"] }))(schema);
    expect(result.properties?.["secret"]?.["x-formbar"]).toBeUndefined();
  });

  it("merges into existing x-formbar without overwriting", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        field: {
          type: "string",
          "x-formbar": { placeholder: "Enter value" },
          "x-weaver": { sensitive: true },
        },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext())(schema);
    expect(result.properties?.["field"]?.["x-formbar"]).toEqual({
      placeholder: "Enter value",
      widget: "password",
    });
  });

  it("walks nested properties recursively", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: {
            deep: { type: "string", "x-weaver": { sensitive: true } },
          },
        },
      },
    };
    const result = weaverToFormbarMiddleware(makeContext())(schema);
    const deep = result.properties?.["nested"]?.properties?.["deep"];
    expect(deep?.["x-formbar"]).toEqual({ widget: "password" });
  });
});
