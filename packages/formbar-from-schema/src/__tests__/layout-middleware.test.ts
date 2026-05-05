import { describe, expect, it } from "vitest";
import type { LayoutNode } from "../layout/layout-types.js";
import type { LayoutMiddleware, LayoutMiddlewareContext } from "../layout-middleware.js";
import { applyLayoutMiddleware } from "../layout-middleware.js";

function makeTree(): LayoutNode {
  return {
    type: "group",
    id: "root",
    children: [
      { type: "field", id: "a", path: "a" },
      {
        type: "group",
        id: "g1",
        children: [{ type: "field", id: "b", path: "b" }],
      },
    ],
  };
}

describe("applyLayoutMiddleware", () => {
  it("identity middleware returns unchanged tree", () => {
    const tree = makeTree();
    const identity: LayoutMiddleware = (node) => node;
    const result = applyLayoutMiddleware(tree, [identity]);
    expect(result).toEqual(tree);
  });

  it("multi-pass: each middleware sees full tree from previous", () => {
    const tree: LayoutNode = { type: "field", id: "leaf", path: "x" };
    const order: string[] = [];

    const mw1: LayoutMiddleware = (node) => {
      order.push("mw1");
      return { ...node, props: { ...node.props, mw1: true } };
    };
    const mw2: LayoutMiddleware = (node) => {
      order.push("mw2");
      // mw2 should see mw1's output
      expect((node.props as Record<string, unknown>)?.mw1).toBe(true);
      return { ...node, props: { ...node.props, mw2: true } };
    };

    const result = applyLayoutMiddleware(tree, [mw1, mw2]);
    expect(order).toEqual(["mw1", "mw2"]);
    expect(result.props).toEqual({ mw1: true, mw2: true });
  });

  it("depth-first: children processed before parent", () => {
    const tree = makeTree();
    const visited: string[] = [];

    const tracker: LayoutMiddleware = (node) => {
      visited.push(node.id);
      return node;
    };

    applyLayoutMiddleware(tree, [tracker]);
    // Children before parents: a, b, g1, root
    expect(visited).toEqual(["a", "b", "g1", "root"]);
  });

  it("wrapping middleware nests correctly", () => {
    const tree: LayoutNode = { type: "field", id: "f", path: "f" };

    const wrapper: LayoutMiddleware = (node) => ({
      type: "group",
      id: `wrap-${node.id}`,
      children: [node],
    });

    const result = applyLayoutMiddleware(tree, [wrapper]);
    expect(result.type).toBe("group");
    expect(result.id).toBe("wrap-f");
    expect(result.children?.[0]).toEqual(tree);
  });

  it("two wrapping middlewares apply in correct order", () => {
    const tree: LayoutNode = { type: "field", id: "f", path: "f" };

    const wrapA: LayoutMiddleware = (node) => ({
      type: "section",
      id: `a-${node.id}`,
      children: [node],
    });
    const wrapB: LayoutMiddleware = (node) => ({
      type: "group",
      id: `b-${node.id}`,
      children: [node],
    });

    const result = applyLayoutMiddleware(tree, [wrapA, wrapB]);
    // wrapA runs first, then wrapB wraps the result
    expect(result.type).toBe("group");
    expect(result.id).toBe("b-a-f");
    expect(result.children?.[0].type).toBe("section");
    expect(result.children?.[0].id).toBe("a-f");
  });

  it("provides correct context (depth, parent, fieldInfo)", () => {
    const tree: LayoutNode = {
      type: "group",
      id: "root",
      children: [{ type: "field", id: "child", path: "name" }],
    };

    const fieldInfo = { path: "name", type: "string" as const, required: false, metadata: {} };
    const fieldInfoMap = new Map([["name", fieldInfo]]);
    const contexts: Array<{ id: string; ctx: LayoutMiddlewareContext }> = [];

    const spy: LayoutMiddleware = (node, ctx) => {
      contexts.push({ id: node.id, ctx });
      return node;
    };

    applyLayoutMiddleware(tree, [spy], fieldInfoMap as ReadonlyMap<string, never>);

    const childCtx = contexts.find((c) => c.id === "child")!;
    expect(childCtx.ctx.depth).toBe(1);
    expect(childCtx.ctx.parent?.id).toBe("root");
    expect(childCtx.ctx.fieldInfo).toBe(fieldInfo);

    const rootCtx = contexts.find((c) => c.id === "root")!;
    expect(rootCtx.ctx.depth).toBe(0);
    expect(rootCtx.ctx.parent).toBeUndefined();
  });

  it("empty middleware array returns tree unchanged", () => {
    const tree = makeTree();
    const result = applyLayoutMiddleware(tree, []);
    expect(result).toEqual(tree);
  });
});
