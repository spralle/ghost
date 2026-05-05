import { describe, expect, it } from "vitest";
import type { LayoutMiddlewareContext, LayoutNode } from "@formbar/from-schema";
import type { SchemaFieldInfo } from "@ghost-shell/schema-core";
import { createGovernanceMiddleware } from "../layout-middleware.js";

function makeFieldInfo(extensions?: Record<string, Record<string, unknown>>): SchemaFieldInfo {
  return {
    path: "test.field",
    type: "string",
    required: false,
    metadata: extensions ? { extensions } : undefined,
  };
}

describe("createGovernanceMiddleware", () => {
  const middleware = createGovernanceMiddleware();

  it("wraps field nodes with weaver metadata in governance-field", () => {
    const node: LayoutNode = { type: "field", id: "f1", path: "test.field" };
    const ctx: LayoutMiddlewareContext = {
      depth: 0,
      fieldInfo: makeFieldInfo({
        weaver: { changePolicy: "restart-required", sensitive: true },
      }),
    };
    const result = middleware(node, ctx);
    expect(result.type).toBe("governance-field");
    expect(result.children).toHaveLength(1);
    expect(result.children![0]).toBe(node);
    expect(result.props).toEqual({
      changePolicy: "restart-required",
      maxOverrideLayer: undefined,
      visibility: undefined,
      reloadBehavior: undefined,
      sensitive: true,
    });
  });

  it("passes through field nodes without weaver metadata", () => {
    const node: LayoutNode = { type: "field", id: "f2", path: "test.field" };
    const ctx: LayoutMiddlewareContext = { depth: 0, fieldInfo: makeFieldInfo() };
    const result = middleware(node, ctx);
    expect(result).toBe(node);
  });

  it("passes through non-field nodes unchanged", () => {
    const node: LayoutNode = { type: "group", id: "g1" };
    const ctx: LayoutMiddlewareContext = { depth: 0 };
    const result = middleware(node, ctx);
    expect(result).toBe(node);
  });

  it("passes through field nodes with no fieldInfo", () => {
    const node: LayoutNode = { type: "field", id: "f3", path: "x" };
    const ctx: LayoutMiddlewareContext = { depth: 0 };
    const result = middleware(node, ctx);
    expect(result).toBe(node);
  });
});
