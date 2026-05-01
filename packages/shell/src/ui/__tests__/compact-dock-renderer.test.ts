import { describe, expect, it } from "vitest";
import type { DockSplitNode, DockStackNode } from "@ghost-shell/state";
import { collectAllTabs } from "../compact-dock-renderer.js";

describe("collectAllTabs", () => {
  it("returns all tabs from a single stack in order", () => {
    const stack: DockStackNode = {
      kind: "stack",
      id: "s1",
      tabIds: ["a", "b", "c"],
      activeTabId: "a",
    };
    expect(collectAllTabs(stack)).toEqual([
      { tabId: "a", stackId: "s1" },
      { tabId: "b", stackId: "s1" },
      { tabId: "c", stackId: "s1" },
    ]);
  });

  it("returns empty array for an empty stack", () => {
    const stack: DockStackNode = {
      kind: "stack",
      id: "s1",
      tabIds: [],
      activeTabId: null,
    };
    expect(collectAllTabs(stack)).toEqual([]);
  });

  it("returns tabs from both stacks in a split (left-to-right)", () => {
    const split: DockSplitNode = {
      kind: "split",
      id: "sp1",
      orientation: "horizontal",
      first: { kind: "stack", id: "s1", tabIds: ["a", "b"], activeTabId: "a" },
      second: { kind: "stack", id: "s2", tabIds: ["c"], activeTabId: "c" },
    };
    expect(collectAllTabs(split)).toEqual([
      { tabId: "a", stackId: "s1" },
      { tabId: "b", stackId: "s1" },
      { tabId: "c", stackId: "s2" },
    ]);
  });

  it("handles nested splits depth-first", () => {
    const nested: DockSplitNode = {
      kind: "split",
      id: "sp-root",
      orientation: "horizontal",
      first: {
        kind: "split",
        id: "sp-left",
        orientation: "vertical",
        first: { kind: "stack", id: "s1", tabIds: ["a"], activeTabId: "a" },
        second: { kind: "stack", id: "s2", tabIds: ["b"], activeTabId: "b" },
      },
      second: { kind: "stack", id: "s3", tabIds: ["c", "d"], activeTabId: "c" },
    };
    expect(collectAllTabs(nested)).toEqual([
      { tabId: "a", stackId: "s1" },
      { tabId: "b", stackId: "s2" },
      { tabId: "c", stackId: "s3" },
      { tabId: "d", stackId: "s3" },
    ]);
  });
});
