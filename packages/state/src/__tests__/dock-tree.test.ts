import { describe, expect, test } from "vitest";
import {
  createInitialDockTree,
  ensureTabRegisteredInDockTree,
  removeTabFromDockTree,
} from "../dock-tree-register-remove.js";
import type { DockStackNode, DockTreeState } from "../dock-tree-types.js";

describe("createInitialDockTree", () => {
  test("creates a tree with a single stack containing the tab", () => {
    const tree = createInitialDockTree("tab-1");
    expect(tree.root).not.toBeNull();
    expect(tree.root?.kind).toBe("stack");
    const stack = tree.root as DockStackNode;
    expect(stack.tabIds).toEqual(["tab-1"]);
    expect(stack.activeTabId).toBe("tab-1");
  });
});

describe("ensureTabRegisteredInDockTree", () => {
  test("returns same tree if tab already exists", () => {
    const tree = createInitialDockTree("tab-1");
    const result = ensureTabRegisteredInDockTree(tree, "tab-1");
    expect(result).toBe(tree);
  });

  test("adds tab to existing stack when tab is new", () => {
    const tree = createInitialDockTree("tab-1");
    const result = ensureTabRegisteredInDockTree(tree, "tab-2");
    expect(result).not.toBe(tree);
    const stack = result.root as DockStackNode;
    expect(stack.tabIds).toContain("tab-1");
    expect(stack.tabIds).toContain("tab-2");
  });

  test("creates new tree when root is null", () => {
    const tree: DockTreeState = { root: null };
    const result = ensureTabRegisteredInDockTree(tree, "tab-1");
    expect(result.root).not.toBeNull();
    expect((result.root as DockStackNode).tabIds).toEqual(["tab-1"]);
  });
});

describe("removeTabFromDockTree", () => {
  test("returns same tree if tab does not exist", () => {
    const tree = createInitialDockTree("tab-1");
    const result = removeTabFromDockTree(tree, "tab-999");
    expect(result).toBe(tree);
  });

  test("removes tab from single-tab stack, collapsing to null", () => {
    const tree = createInitialDockTree("tab-1");
    const result = removeTabFromDockTree(tree, "tab-1");
    expect(result.root).toBeNull();
  });

  test("removes tab from multi-tab stack, keeping remaining tabs", () => {
    let tree = createInitialDockTree("tab-1");
    tree = ensureTabRegisteredInDockTree(tree, "tab-2");
    tree = ensureTabRegisteredInDockTree(tree, "tab-3");

    const result = removeTabFromDockTree(tree, "tab-2");
    const stack = result.root as DockStackNode;
    expect(stack.tabIds).toEqual(["tab-1", "tab-3"]);
    expect(stack.tabIds).not.toContain("tab-2");
  });

  test("updates activeTabId when active tab is removed", () => {
    let tree = createInitialDockTree("tab-1");
    tree = ensureTabRegisteredInDockTree(tree, "tab-2");
    // tab-1 is the active tab in the initial tree
    const result = removeTabFromDockTree(tree, "tab-1");
    const stack = result.root as DockStackNode;
    expect(stack.activeTabId).toBe("tab-2");
  });

  test("returns same tree when root is null", () => {
    const tree: DockTreeState = { root: null };
    const result = removeTabFromDockTree(tree, "tab-1");
    expect(result).toBe(tree);
  });

  test("collapses split when one side becomes empty", () => {
    // Build a split tree manually
    const splitTree: DockTreeState = {
      root: {
        kind: "split",
        id: "split-1",
        orientation: "horizontal",
        first: {
          kind: "stack",
          id: "stack-1",
          tabIds: ["tab-1"],
          activeTabId: "tab-1",
        },
        second: {
          kind: "stack",
          id: "stack-2",
          tabIds: ["tab-2"],
          activeTabId: "tab-2",
        },
      },
    };

    const result = removeTabFromDockTree(splitTree, "tab-2");
    // Should collapse to just the remaining stack
    expect(result.root).not.toBeNull();
    expect(result.root?.kind).toBe("stack");
    expect((result.root as DockStackNode).tabIds).toEqual(["tab-1"]);
  });
});
