import { describe, expect, test } from "vitest";
import type { DockSplitNode, DockStackNode, DockTreeState } from "../dock-tree-types.js";
import { createDwindlePlacementStrategy } from "../placement-strategy/dwindle.js";
import { createStackPlacementStrategy } from "../placement-strategy/stack.js";
import { createTabsPlacementStrategy } from "../placement-strategy/tabs.js";
import type { PlacementContext } from "../placement-strategy/types.js";

describe("createTabsPlacementStrategy", () => {
  const strategy = createTabsPlacementStrategy();

  test("has id 'tabs'", () => {
    expect(strategy.id).toBe("tabs");
  });

  test("creates initial stack when tree is empty", () => {
    const ctx: PlacementContext = { tabId: "tab-1", tree: { root: null } };
    const result = strategy.place(ctx);
    expect(result.tree.root).not.toBeNull();
    const stack = result.tree.root as DockStackNode;
    expect(stack.tabIds).toEqual(["tab-1"]);
    expect(stack.activeTabId).toBe("tab-1");
  });

  test("returns same tree if tab already exists", () => {
    const tree: DockTreeState = {
      root: { kind: "stack", id: "s1", tabIds: ["tab-1"], activeTabId: "tab-1" },
    };
    const result = strategy.place({ tabId: "tab-1", tree });
    expect(result.tree).toBe(tree);
  });

  test("appends tab to existing stack", () => {
    const tree: DockTreeState = {
      root: { kind: "stack", id: "s1", tabIds: ["tab-1"], activeTabId: "tab-1" },
    };
    const result = strategy.place({ tabId: "tab-2", tree });
    const stack = result.tree.root as DockStackNode;
    expect(stack.tabIds).toContain("tab-2");
    // Does not change activeTabId (keeps existing)
    expect(stack.activeTabId).toBe("tab-1");
  });
});

describe("createStackPlacementStrategy", () => {
  const strategy = createStackPlacementStrategy();

  test("has id 'stack'", () => {
    expect(strategy.id).toBe("stack");
  });

  test("creates initial stack when tree is empty", () => {
    const result = strategy.place({ tabId: "tab-1", tree: { root: null } });
    const stack = result.tree.root as DockStackNode;
    expect(stack.tabIds).toEqual(["tab-1"]);
    expect(stack.activeTabId).toBe("tab-1");
    expect(stack.navHistory).toEqual({ back: [], forward: [] });
  });

  test("sets new tab as active and pushes previous to back history", () => {
    const tree: DockTreeState = {
      root: {
        kind: "stack",
        id: "s1",
        tabIds: ["tab-1"],
        activeTabId: "tab-1",
        navHistory: { back: [], forward: [] },
      },
    };
    const result = strategy.place({ tabId: "tab-2", tree });
    const stack = result.tree.root as DockStackNode;
    expect(stack.activeTabId).toBe("tab-2");
    expect(stack.tabIds).toContain("tab-2");
    expect(stack.navHistory?.back).toContain("tab-1");
    expect(stack.navHistory?.forward).toEqual([]);
  });

  test("navigateBack returns to previous tab", () => {
    const tree: DockTreeState = {
      root: {
        kind: "stack",
        id: "s1",
        tabIds: ["tab-1", "tab-2"],
        activeTabId: "tab-2",
        navHistory: { back: ["tab-1"], forward: [] },
      },
    };
    const result = strategy.navigateBack?.("s1", tree);
    expect(result).not.toBeNull();
    expect(result?.activatedTabId).toBe("tab-1");
  });

  test("navigateBack returns null when no history", () => {
    const tree: DockTreeState = {
      root: {
        kind: "stack",
        id: "s1",
        tabIds: ["tab-1"],
        activeTabId: "tab-1",
        navHistory: { back: [], forward: [] },
      },
    };
    const result = strategy.navigateBack?.("s1", tree);
    expect(result).toBeNull();
  });

  test("navigateForward moves forward in history", () => {
    const tree: DockTreeState = {
      root: {
        kind: "stack",
        id: "s1",
        tabIds: ["tab-1", "tab-2"],
        activeTabId: "tab-1",
        navHistory: { back: [], forward: ["tab-2"] },
      },
    };
    const result = strategy.navigateForward?.("s1", tree);
    expect(result).not.toBeNull();
    expect(result?.activatedTabId).toBe("tab-2");
  });

  test("onTabClosed removes tab from nav history", () => {
    const tree: DockTreeState = {
      root: {
        kind: "stack",
        id: "s1",
        tabIds: ["tab-1", "tab-2"],
        activeTabId: "tab-1",
        navHistory: { back: ["tab-2"], forward: ["tab-2"] },
      },
    };
    const result = strategy.onTabClosed?.({ tabId: "tab-2", stackId: "s1", tree });
    const stack = result.root as DockStackNode;
    expect(stack.navHistory?.back).not.toContain("tab-2");
    expect(stack.navHistory?.forward).not.toContain("tab-2");
  });
});

describe("createDwindlePlacementStrategy", () => {
  const strategy = createDwindlePlacementStrategy();

  test("has id 'dwindle'", () => {
    expect(strategy.id).toBe("dwindle");
  });

  test("creates initial stack when tree is empty", () => {
    const result = strategy.place({ tabId: "tab-1", tree: { root: null } });
    const stack = result.tree.root as DockStackNode;
    expect(stack.tabIds).toEqual(["tab-1"]);
  });

  test("creates a split when adding second tab", () => {
    const tree: DockTreeState = {
      root: { kind: "stack", id: "s1", tabIds: ["tab-1"], activeTabId: "tab-1" },
    };
    const result = strategy.place({ tabId: "tab-2", tree });
    expect(result.tree.root?.kind).toBe("split");
    const split = result.tree.root as DockSplitNode;
    // First child is original stack, second is new
    expect(split.first.kind).toBe("stack");
    expect(split.second.kind).toBe("stack");
    expect((split.second as DockStackNode).tabIds).toEqual(["tab-2"]);
  });

  test("alternates orientation at increasing depth", () => {
    const tree: DockTreeState = {
      root: { kind: "stack", id: "s1", tabIds: ["tab-1"], activeTabId: "tab-1" },
    };
    // Depth 0 → horizontal
    const r1 = strategy.place({ tabId: "tab-2", tree, dwindleDirection: "alternate" });
    const split1 = r1.tree.root as DockSplitNode;
    expect(split1.orientation).toBe("horizontal");

    // Depth 1 → vertical (split into the second child which is at depth 1)
    const r2 = strategy.place({
      tabId: "tab-3",
      tree: r1.tree,
      activeStackId: r1.targetStackId,
      dwindleDirection: "alternate",
    });
    // The new split should be vertical
    const split2 = r2.tree.root as DockSplitNode;
    const innerSplit = split2.second as DockSplitNode;
    expect(innerSplit.kind).toBe("split");
    expect(innerSplit.orientation).toBe("vertical");
  });

  test("returns same tree if tab already exists", () => {
    const tree: DockTreeState = {
      root: { kind: "stack", id: "s1", tabIds: ["tab-1"], activeTabId: "tab-1" },
    };
    const result = strategy.place({ tabId: "tab-1", tree });
    expect(result.tree).toBe(tree);
  });
});
