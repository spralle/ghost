import { describe, expect, test } from "vitest";
import type { SchemaIngestionResult } from "@ghost-shell/schema-core";
import { FromSchemaError } from "../errors.js";
import { compileLayout } from "../layout/layout-compiler.js";
import { LayoutNodeRegistry } from "../layout/layout-registry.js";
import { isArrayNode, isFieldNode, isGroupNode, isSectionNode, type LayoutNode } from "../layout/layout-types.js";

// --- Type guards ---

describe("layout type guards", () => {
  test("isFieldNode returns true for field nodes", () => {
    const node: LayoutNode = { type: "field", id: "f1", path: "name" };
    expect(isFieldNode(node)).toBe(true);
  });

  test("isFieldNode returns false for non-field nodes", () => {
    const node: LayoutNode = { type: "group", id: "g1" };
    expect(isFieldNode(node)).toBe(false);
  });

  test("isArrayNode returns true for array nodes", () => {
    const node: LayoutNode = { type: "array", id: "a1", path: "items", children: [] };
    expect(isArrayNode(node)).toBe(true);
  });

  test("isGroupNode returns true for group nodes", () => {
    expect(isGroupNode({ type: "group", id: "g1" })).toBe(true);
  });

  test("isSectionNode returns true for section nodes", () => {
    expect(isSectionNode({ type: "section", id: "s1" })).toBe(true);
  });
});

// --- Registry ---

describe("LayoutNodeRegistry", () => {
  test("register and retrieve custom node type", () => {
    const registry = new LayoutNodeRegistry();
    registry.register("rating", { type: "rating", rendererKey: "RatingWidget" });
    expect(registry.get("rating")).toEqual({ type: "rating", rendererKey: "RatingWidget" });
  });

  test("has returns true for built-in types", () => {
    const registry = new LayoutNodeRegistry();
    expect(registry.has("field")).toBe(true);
    expect(registry.has("group")).toBe(true);
    expect(registry.has("section")).toBe(true);
    expect(registry.has("array")).toBe(true);
  });

  test("cannot override built-in types", () => {
    const registry = new LayoutNodeRegistry();
    expect(() => registry.register("field", { type: "field", rendererKey: "x" })).toThrow(FromSchemaError);
  });

  test("validate passes for known types", () => {
    const registry = new LayoutNodeRegistry();
    const tree: LayoutNode = {
      type: "group",
      id: "root",
      children: [{ type: "field", id: "f1", path: "name" }],
    };
    expect(() => registry.validate(tree)).not.toThrow();
  });

  test("validate throws FORMBAR_LAYOUT_UNKNOWN_NODE_TYPE for unknown types", () => {
    const registry = new LayoutNodeRegistry();
    const tree: LayoutNode = {
      type: "group",
      id: "root",
      children: [{ type: "custom-widget", id: "c1" }],
    };
    try {
      registry.validate(tree);
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(FromSchemaError);
      expect((err as FromSchemaError).code).toBe("FORMBAR_LAYOUT_UNKNOWN_NODE_TYPE");
    }
  });

  test("validate passes for registered custom types", () => {
    const registry = new LayoutNodeRegistry();
    registry.register("custom-widget", { type: "custom-widget", rendererKey: "CW" });
    const tree: LayoutNode = {
      type: "group",
      id: "root",
      children: [{ type: "custom-widget", id: "c1" }],
    };
    expect(() => registry.validate(tree)).not.toThrow();
  });
});

// --- Compiler ---

function makeResult(fields: SchemaIngestionResult["fields"]): SchemaIngestionResult {
  return { fields, metadata: {} };
}

describe("compileLayout", () => {
  test("flat schema produces field nodes", () => {
    const result = makeResult([
      { path: "name", type: "string", required: true },
      { path: "age", type: "number", required: false },
    ]);
    const tree = compileLayout(result);
    expect(tree.type).toBe("group");
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[0]).toEqual({ type: "field", id: "layout-name", path: "name" });
    expect(tree.children?.[1]).toEqual({ type: "field", id: "layout-age", path: "age" });
  });

  test("nested object produces group + field nodes", () => {
    const result = makeResult([
      { path: "address.street", type: "string", required: true },
      { path: "address.city", type: "string", required: true },
    ]);
    const tree = compileLayout(result);
    expect(tree.children).toHaveLength(1);
    const group = tree.children?.[0];
    expect(group.type).toBe("group");
    expect(group.id).toBe("layout-address");
    expect(group.children).toHaveLength(2);
    expect(group.children?.[0]).toEqual({
      type: "field",
      id: "layout-address.street",
      path: "address.street",
    });
  });

  test("array field produces array node with child template", () => {
    const result = makeResult([{ path: "tags", type: "array", required: false }]);
    const tree = compileLayout(result);
    const arrayNode = tree.children?.[0];
    expect(arrayNode.type).toBe("array");
    expect(arrayNode.path).toBe("tags");
    expect(arrayNode.children).toHaveLength(1);
  });

  test("preserves schema property order", () => {
    const result = makeResult([
      { path: "z", type: "string", required: false },
      { path: "a", type: "string", required: false },
      { path: "m", type: "string", required: false },
    ]);
    const tree = compileLayout(result);
    expect(tree.children?.map((c) => c.path)).toEqual(["z", "a", "m"]);
  });

  test("overrideLayout replaces schema-derived tree", () => {
    const result = makeResult([{ path: "name", type: "string", required: true }]);
    const override: LayoutNode = { type: "section", id: "custom", children: [] };
    const tree = compileLayout(result, { overrideLayout: override });
    expect(tree).toBe(override);
  });
});
