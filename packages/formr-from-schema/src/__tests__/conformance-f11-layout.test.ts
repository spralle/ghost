import { describe, expect, test } from "vitest";
import type { LayoutNode, SchemaIngestionResult } from "../index.js";
import {
  compileLayout,
  FromSchemaError,
  isArrayNode,
  isFieldNode,
  isGroupNode,
  isSectionNode,
  LayoutNodeRegistry,
} from "../index.js";

/**
 * F11: Layout model conformance fixtures.
 * Verifies: schema-to-layout compilation, built-in node types,
 * custom node registration, unknown node rejection.
 */

function makeResult(fields: SchemaIngestionResult["fields"]): SchemaIngestionResult {
  return { fields, metadata: {} };
}

// --- A. Schema-to-layout compilation ---

describe("F11.A: Schema-to-layout compilation", () => {
  test("F11.01: Flat schema with leaf properties produces field nodes", () => {
    const result = makeResult([
      { path: "name", type: "string", required: true },
      { path: "age", type: "number", required: false },
    ]);
    const tree = compileLayout(result);
    expect(tree.type).toBe("group");
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[0].type).toBe("field");
    expect(tree.children?.[0].path).toBe("name");
    expect(tree.children?.[1].type).toBe("field");
    expect(tree.children?.[1].path).toBe("age");
  });

  test("F11.02: Nested object produces group node with field children", () => {
    const result = makeResult([
      { path: "address.street", type: "string", required: true },
      { path: "address.city", type: "string", required: true },
    ]);
    const tree = compileLayout(result);
    const addressNode = tree.children?.[0];
    expect(addressNode.type).toBe("group");
    expect(addressNode.children).toHaveLength(2);
    expect(addressNode.children?.[0].path).toBe("address.street");
    expect(addressNode.children?.[1].path).toBe("address.city");
  });

  test("F11.03: Array schema produces array node with child template", () => {
    const result = makeResult([{ path: "tags", type: "array", required: false }]);
    const tree = compileLayout(result);
    const arrayNode = tree.children?.[0];
    expect(arrayNode.type).toBe("array");
    expect(arrayNode.path).toBe("tags");
    expect(arrayNode.children).toBeDefined();
    expect(arrayNode.children?.length).toBeGreaterThan(0);
  });

  test("F11.04: Compilation preserves property order (tree structure deterministic)", () => {
    const result = makeResult([
      { path: "z_last", type: "string", required: false },
      { path: "a_first", type: "string", required: false },
      { path: "m_middle", type: "string", required: false },
    ]);
    const tree = compileLayout(result);
    const paths = tree.children?.map((c) => c.path);
    expect(paths).toEqual(["z_last", "a_first", "m_middle"]);
  });
});

// --- B. Built-in node types ---

describe("F11.B: Built-in node types", () => {
  const fieldNode: LayoutNode = { type: "field", id: "f1", path: "name" };
  const groupNode: LayoutNode = { type: "group", id: "g1", children: [] };
  const sectionNode: LayoutNode = { type: "section", id: "s1", children: [] };
  const arrayNode: LayoutNode = { type: "array", id: "a1", path: "items", children: [] };

  test("F11.05: isFieldNode type guard identifies field nodes", () => {
    expect(isFieldNode(fieldNode)).toBe(true);
    expect(isFieldNode(groupNode)).toBe(false);
  });

  test("F11.06: isGroupNode type guard identifies group nodes", () => {
    expect(isGroupNode(groupNode)).toBe(true);
    expect(isGroupNode(fieldNode)).toBe(false);
  });

  test("F11.07: isSectionNode type guard identifies section nodes", () => {
    expect(isSectionNode(sectionNode)).toBe(true);
    expect(isSectionNode(fieldNode)).toBe(false);
  });

  test("F11.08: isArrayNode type guard identifies array nodes", () => {
    expect(isArrayNode(arrayNode)).toBe(true);
    expect(isArrayNode(fieldNode)).toBe(false);
  });
});

// --- C. Custom node registration ---

describe("F11.C: Custom node registration", () => {
  test("F11.09: Registry accepts custom node type via register()", () => {
    const registry = new LayoutNodeRegistry();
    registry.register("custom-widget", { type: "custom-widget", rendererKey: "widget-v1" });
    expect(registry.has("custom-widget")).toBe(true);
    expect(registry.get("custom-widget")?.rendererKey).toBe("widget-v1");
  });

  test("F11.10: Registry validate() passes for tree with registered custom type", () => {
    const registry = new LayoutNodeRegistry();
    registry.register("custom-widget", { type: "custom-widget", rendererKey: "widget-v1" });
    const tree: LayoutNode = {
      type: "group",
      id: "root",
      children: [{ type: "custom-widget", id: "cw1" }],
    };
    expect(() => registry.validate(tree)).not.toThrow();
  });
});

// --- D. Unknown node rejection ---

describe("F11.D: Unknown node rejection", () => {
  test("F11.11: Registry validate() throws FORMR_LAYOUT_UNKNOWN_NODE_TYPE for unknown node type", () => {
    const registry = new LayoutNodeRegistry();
    const tree: LayoutNode = {
      type: "group",
      id: "root",
      children: [{ type: "totally-unknown", id: "u1" }],
    };
    try {
      registry.validate(tree);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(FromSchemaError);
      expect((e as FromSchemaError).code).toBe("FORMR_LAYOUT_UNKNOWN_NODE_TYPE");
    }
  });
});
