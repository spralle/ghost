import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@ghost-shell/schema-core";
import type { WeaverFormrContext } from "../schema-middleware.js";
import { weaverToFormrMiddleware } from "../schema-middleware.js";

function makeContext(overrides?: Partial<WeaverFormrContext>): WeaverFormrContext {
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

describe("weaverToFormrMiddleware", () => {
  it("injects widget: password for sensitive fields", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        apiKey: { type: "string", "x-weaver": { sensitive: true } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext())(schema);
    const prop = result.properties?.["apiKey"];
    expect(prop?.["x-formr"]).toEqual({ widget: "password" });
  });

  it("injects readOnly when layer rank exceeds maxOverrideLayer ceiling", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        setting: { type: "string", "x-weaver": { maxOverrideLayer: "system" } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext({ layerRank: 2 }))(schema);
    expect(result.properties?.["setting"]?.["x-formr"]).toEqual({ readOnly: true });
  });

  it("does NOT inject readOnly when layer rank is within ceiling", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        setting: { type: "string", "x-weaver": { maxOverrideLayer: "workspace" } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext({ layerRank: 2 }))(schema);
    expect(result.properties?.["setting"]?.["x-formr"]).toBeUndefined();
  });

  it("injects readOnly for non-direct changePolicy when no session", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        port: { type: "number", "x-weaver": { changePolicy: "restart-required" } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext({ sessionActive: undefined }))(schema);
    expect(result.properties?.["port"]?.["x-formr"]).toEqual({ readOnly: true });
  });

  it("does NOT inject readOnly for non-direct changePolicy when session active", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        port: { type: "number", "x-weaver": { changePolicy: "restart-required" } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext({ sessionActive: true }))(schema);
    expect(result.properties?.["port"]?.["x-formr"]).toBeUndefined();
  });

  it("injects hidden when visibility role not in authRoles", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        secret: { type: "string", "x-weaver": { visibility: "superadmin" } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext({ authRoles: ["editor"] }))(schema);
    expect(result.properties?.["secret"]?.["x-formr"]).toEqual({ hidden: true });
  });

  it("does NOT inject hidden when visibility role is in authRoles", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        secret: { type: "string", "x-weaver": { visibility: "admin" } },
      },
    };
    const result = weaverToFormrMiddleware(makeContext({ authRoles: ["admin"] }))(schema);
    expect(result.properties?.["secret"]?.["x-formr"]).toBeUndefined();
  });

  it("merges into existing x-formr without overwriting", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        field: {
          type: "string",
          "x-formr": { placeholder: "Enter value" },
          "x-weaver": { sensitive: true },
        },
      },
    };
    const result = weaverToFormrMiddleware(makeContext())(schema);
    expect(result.properties?.["field"]?.["x-formr"]).toEqual({
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
    const result = weaverToFormrMiddleware(makeContext())(schema);
    const deep = result.properties?.["nested"]?.properties?.["deep"];
    expect(deep?.["x-formr"]).toEqual({ widget: "password" });
  });
});
