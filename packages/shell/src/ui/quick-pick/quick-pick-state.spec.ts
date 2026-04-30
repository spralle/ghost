import { describe, expect, it } from "vitest";
import type { QuickPickItem } from "@ghost-shell/contracts";
import {
  computeFuzzyScore,
  createInitialQuickPickState,
  getSelectedItem,
  reduceQuickPickState,
  scoreQuickPickItems,
} from "./quick-pick-state.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface TestItem extends QuickPickItem {
  id: string;
}

function makeItem(overrides: Partial<TestItem> & { id: string; label: string }): TestItem {
  return {
    enabled: true,
    ...overrides,
  };
}

function sampleItems(): readonly TestItem[] {
  return [
    makeItem({ id: "shell.focus.left", label: "Focus Left Panel" }),
    makeItem({ id: "shell.focus.right", label: "Focus Right Panel" }),
    makeItem({
      id: "shell.toggle.sidebar",
      label: "Toggle Sidebar",
      description: "command",
    }),
    makeItem({
      id: "plugin.run.test",
      label: "Run Tests",
      description: "plugin.testing",
    }),
    makeItem({
      id: "plugin.disabled.action",
      label: "Disabled Action",
      enabled: false,
      detail: "Requires admin role",
    }),
  ];
}

// ---------------------------------------------------------------------------
// Spec registration
// ---------------------------------------------------------------------------

describe("quick pick state", () => {
  // 1. createInitialQuickPickState returns closed state
  it("createInitialQuickPickState returns closed state", () => {
    const state = createInitialQuickPickState<TestItem>();
    expect(state.phase).toBe("closed");
    expect(state.filter).toBe("");
    expect(state.selectedIndex).toBe(0);
    expect(state.items.length).toBe(0);
    expect(state.filteredItems.length).toBe(0);
  });

  // 2. open transitions to open phase with items and filtered list
  it("open transitions to open phase with items", () => {
    const items = sampleItems();
    const state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });

    expect(state.phase).toBe("open");
    expect(state.filter).toBe("");
    expect(state.selectedIndex).toBe(0);
    expect(state.items.length).toBe(items.length);
    expect(state.filteredItems.length).toBe(items.length);
  });

  // 3. close returns to initial state
  it("close returns to initial state", () => {
    const items = sampleItems();
    const openState = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });
    const closedState = reduceQuickPickState(openState, { type: "close" });

    expect(closedState.phase).toBe("closed");
    expect(closedState.filter).toBe("");
    expect(closedState.items.length).toBe(0);
    expect(closedState.filteredItems.length).toBe(0);
  });

  // 4. updateFilter filters items and resets selectedIndex
  it("updateFilter filters items and resets selectedIndex", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });
    state = reduceQuickPickState(state, { type: "selectNext" });
    expect(state.selectedIndex).toBe(1);

    state = reduceQuickPickState(state, {
      type: "updateFilter",
      filter: "Focus",
    });
    expect(state.selectedIndex).toBe(0);
    expect(state.filter).toBe("Focus");
    expect(state.filteredItems.length).toBe(2);
  });

  // 5. updateFilter with empty string shows all items
  it("updateFilter with empty string shows all items", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });
    state = reduceQuickPickState(state, {
      type: "updateFilter",
      filter: "Focus",
    });
    expect(state.filteredItems.length).toBe(2);

    state = reduceQuickPickState(state, {
      type: "updateFilter",
      filter: "",
    });
    expect(state.filteredItems.length).toBe(items.length);
  });

  // 6. selectNext wraps around at end
  it("selectNext wraps around at end", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });

    for (let i = 0; i < items.length - 1; i++) {
      state = reduceQuickPickState(state, { type: "selectNext" });
    }
    expect(state.selectedIndex).toBe(items.length - 1);

    state = reduceQuickPickState(state, { type: "selectNext" });
    expect(state.selectedIndex).toBe(0);
  });

  // 7. selectPrevious wraps around at start
  it("selectPrevious wraps around at start", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });
    expect(state.selectedIndex).toBe(0);

    state = reduceQuickPickState(state, { type: "selectPrevious" });
    expect(state.selectedIndex).toBe(state.filteredItems.length - 1);
  });

  // 8. selectIndex clamps to valid range
  it("selectIndex clamps to valid range", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });

    state = reduceQuickPickState(state, { type: "selectIndex", index: 999 });
    expect(state.selectedIndex).toBe(state.filteredItems.length - 1);

    state = reduceQuickPickState(state, { type: "selectIndex", index: -5 });
    expect(state.selectedIndex).toBe(0);
  });

  // 9. getSelectedItem returns correct item
  it("getSelectedItem returns correct item", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });

    const first = getSelectedItem(state);
    expect(first).toBeTruthy();

    state = reduceQuickPickState(state, { type: "selectNext" });
    const second = getSelectedItem(state);
    expect(second).toBeTruthy();
    expect(first?.id !== second?.id || first?.label !== second?.label || state.selectedIndex === 0).toBeTruthy();
  });

  // 10. getSelectedItem returns null when no items
  it("getSelectedItem returns null when no items", () => {
    const state = createInitialQuickPickState<TestItem>();
    const item = getSelectedItem(state);
    expect(item).toBe(null);
  });

  // 11. Fuzzy scoring: exact label match scores highest
  it("fuzzy scoring: exact label match scores highest", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const score = computeFuzzyScore(item, "focus left panel");
    expect(score >= 90).toBeTruthy();
  });

  // 12. Fuzzy scoring: prefix match ranks above substring match
  it("fuzzy scoring: prefix match ranks above substring", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const prefixScore = computeFuzzyScore(item, "focus");
    const substringScore = computeFuzzyScore(item, "left");
    expect(prefixScore > substringScore).toBeTruthy();
  });

  // 13. Fuzzy scoring: subsequence match works
  it("fuzzy scoring: subsequence match works", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const score = computeFuzzyScore(item, "flp");
    expect(score > 0).toBeTruthy();
    expect(score >= 50).toBeTruthy();
  });

  // 14. Fuzzy scoring: no-match items are excluded
  it("fuzzy scoring: no-match items are excluded", () => {
    const item = makeItem({ id: "a", label: "Focus Left Panel" });
    const score = computeFuzzyScore(item, "zzz");
    expect(score).toBe(0);
  });

  // 15. Enabled items sort before disabled when scores are equal
  it("enabled items sort before disabled when scores equal", () => {
    const items: readonly TestItem[] = [
      makeItem({ id: "b", label: "Beta Action", enabled: false }),
      makeItem({ id: "a", label: "Alpha Action", enabled: true }),
    ];
    const scored = scoreQuickPickItems(items, "");
    expect(scored[0]?.item.id).toBe("a");
    expect(scored[1]?.item.id).toBe("b");
  });

  // 16. Empty filter returns all items sorted enabled-first then alphabetical
  it("empty filter returns all items sorted enabled-first alphabetical", () => {
    const items: readonly TestItem[] = [
      makeItem({ id: "z", label: "Zebra Command", enabled: true }),
      makeItem({ id: "a", label: "Alpha Command", enabled: false }),
      makeItem({ id: "m", label: "Middle Command", enabled: true }),
    ];
    const scored = scoreQuickPickItems(items, "");
    expect(scored.length).toBe(3);
    expect(scored[0]?.item.id).toBe("m");
    expect(scored[1]?.item.id).toBe("z");
    expect(scored[2]?.item.id).toBe("a");
  });

  // 17. matchOnDescription enables description matching
  it("matchOnDescription enables description matching", () => {
    const item = makeItem({
      id: "a",
      label: "Some Action",
      description: "useful utility",
    });
    const withoutOpt = computeFuzzyScore(item, "useful");
    const withOpt = computeFuzzyScore(item, "useful", {
      matchOnDescription: true,
    });
    expect(withoutOpt).toBe(0);
    expect(withOpt).toBe(70);
  });

  // 18. matchOnDetail enables detail matching
  it("matchOnDetail enables detail matching", () => {
    const item = makeItem({
      id: "a",
      label: "Some Action",
      detail: "detailed info here",
    });
    const withoutOpt = computeFuzzyScore(item, "detailed");
    const withOpt = computeFuzzyScore(item, "detailed", {
      matchOnDetail: true,
    });
    expect(withoutOpt).toBe(0);
    expect(withOpt).toBe(60);
  });

  // 19. setItems action updates items and re-scores
  it("setItems updates items and re-scores", () => {
    const items = sampleItems();
    let state = reduceQuickPickState(createInitialQuickPickState<TestItem>(), { type: "open", items });
    expect(state.items.length).toBe(5);

    const newItems = [makeItem({ id: "new.1", label: "New Item" })];
    state = reduceQuickPickState(state, { type: "setItems", items: newItems });
    expect(state.items.length).toBe(1);
    expect(state.filteredItems.length).toBe(1);
    expect(state.selectedIndex).toBe(0);
  });
});
