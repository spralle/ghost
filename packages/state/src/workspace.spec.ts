import { describe, expect, it } from "vitest";
import { createInitialShellContextState } from "./state.js";
import { registerTab } from "./tabs-groups.js";
import {
  createInitialWorkspaceManagerState,
  createWorkspace,
  deleteWorkspace,
  moveTabToWorkspace,
  renameWorkspace,
  reorderWorkspace,
  switchWorkspace,
} from "./workspace.js";

describe("workspace", () => {
  // --- createInitialWorkspaceManagerState ---

  it("createInitialWorkspaceManagerState creates valid state with 1 workspace", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    expect(state.activeWorkspaceId).toBe("1");
    expect(state.workspaceOrder).toEqual(["1"]);
    expect(state.workspaces["1"].name).toBe("1");
    expect(state.workspaces["1"].contextState.activeTabId).toBe(ctx.activeTabId);
  });

  it("createInitialWorkspaceManagerState does not share references with input", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    ctx.tabOrder.push("injected");
    expect(state.workspaces["1"].contextState.tabOrder.includes("injected")).toBe(false);
  });

  // --- createWorkspace ---

  it("createWorkspace auto-names correctly", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = createWorkspace(state);
    expect(result.changed).toBe(true);
    const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
    expect(newIds.length).toBe(1);
    const newWs = result.state.workspaces[newIds[0]];
    expect(newWs.name).toBe("2");
  });

  it("createWorkspace handles custom name", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = createWorkspace(state, "My Workspace");
    const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
    const newWs = result.state.workspaces[newIds[0]];
    expect(newWs.name).toBe("My Workspace");
  });

  it("createWorkspace generates unique IDs", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const r1 = createWorkspace(state);
    const r2 = createWorkspace(r1.state);
    const ids = r2.state.workspaceOrder;
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("createWorkspace auto-naming increments past highest numeric name", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    // rename workspace "1" to "3"
    state = renameWorkspace(state, "1", "3").state;
    const result = createWorkspace(state);
    const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
    const newWs = result.state.workspaces[newIds[0]];
    expect(newWs.name).toBe("4");
  });

  it("createWorkspace creates empty context state", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = createWorkspace(state);
    const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
    const newCtx = result.state.workspaces[newIds[0]].contextState;
    expect(newCtx.activeTabId).toBe(null);
    expect(Object.keys(newCtx.tabs).length).toBe(0);
    expect(newCtx.dockTree.root).toBe(null);
  });

  // --- deleteWorkspace ---

  it("deleteWorkspace refuses to delete last workspace", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = deleteWorkspace(state, "1");
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });

  it("deleteWorkspace removes from workspaceOrder", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    const r1 = createWorkspace(state);
    state = r1.state;
    const newId = state.workspaceOrder.find((id) => id !== "1")!;
    const result = deleteWorkspace(state, newId);
    expect(result.changed).toBe(true);
    expect(result.state.workspaceOrder.includes(newId)).toBe(false);
    expect(result.state.workspaces[newId]).toBe(undefined);
  });

  it("deleteWorkspace switches to adjacent when deleting active", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    state = createWorkspace(state).state;
    // Order is ["1", id2, id3]
    const id2 = state.workspaceOrder[1];
    const id3 = state.workspaceOrder[2];
    // Switch to id2
    state = switchWorkspace(state, id2, ctx).state;
    // Delete id2 — should switch to id3 (next in order)
    const result = deleteWorkspace(state, id2);
    expect(result.changed).toBe(true);
    expect(result.state.activeWorkspaceId).toBe(id3);
  });

  it("deleteWorkspace switches to previous when deleting last in order", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    const lastId = state.workspaceOrder[state.workspaceOrder.length - 1];
    // Switch to last
    state = switchWorkspace(state, lastId, ctx).state;
    const result = deleteWorkspace(state, lastId);
    expect(result.state.activeWorkspaceId).toBe("1");
  });

  // --- switchWorkspace ---

  it("switchWorkspace no-op when switching to current", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = switchWorkspace(state, "1", ctx);
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });

  it("switchWorkspace snapshots current state and loads target", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    const targetId = state.workspaceOrder[1];

    // Modify the "live" context state to simulate runtime changes
    const liveCtx = createInitialShellContextState({ initialTabId: "tab-live" });

    const result = switchWorkspace(state, targetId, liveCtx);
    expect(result.changed).toBe(true);
    expect(result.previousWorkspaceId).toBe("1");
    expect(result.state.activeWorkspaceId).toBe(targetId);
    // Verify snapshot: workspace "1" should now have the live state
    const snapshotted = result.state.workspaces["1"].contextState;
    expect(snapshotted.activeTabId).toBe("tab-live");
    // Verify loaded: active context should be the target's (empty) state
    expect(result.activeContextState.activeTabId).toBe(null);
  });

  // --- renameWorkspace ---

  it("renameWorkspace updates name", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = renameWorkspace(state, "1", "Home");
    expect(result.changed).toBe(true);
    expect(result.state.workspaces["1"].name).toBe("Home");
  });

  it("renameWorkspace returns changed false for unknown id", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = renameWorkspace(state, "nonexistent", "Test");
    expect(result.changed).toBe(false);
  });

  // --- reorderWorkspace ---

  it("reorderWorkspace moves workspace in order", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    state = createWorkspace(state).state;
    const ids = [...state.workspaceOrder]; // ["1", id2, id3]
    const result = reorderWorkspace(state, ids[2], 0);
    expect(result.changed).toBe(true);
    expect(result.state.workspaceOrder[0]).toBe(ids[2]);
    expect(result.state.workspaceOrder[1]).toBe(ids[0]);
    expect(result.state.workspaceOrder[2]).toBe(ids[1]);
  });

  it("reorderWorkspace clamps index to valid range", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    const result = reorderWorkspace(state, "1", 999);
    expect(result.changed).toBe(true);
    expect(
      result.state.workspaceOrder[result.state.workspaceOrder.length - 1],
    ).toBe("1");
  });

  it("reorderWorkspace returns changed false when position unchanged", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = reorderWorkspace(state, "1", 0);
    expect(result.changed).toBe(false);
  });

  // --- moveTabToWorkspace ---

  it("moveTabToWorkspace transfers tab and all associated state", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    const targetId = state.workspaceOrder[1];

    // Source has "tab-main" from createInitialShellContextState
    const liveCtx = createInitialShellContextState();
    const result = moveTabToWorkspace(state, "tab-main", "1", targetId, liveCtx);
    expect(result.changed).toBe(true);

    // Source should no longer have the tab
    const sourceCtx = result.state.workspaces["1"].contextState;
    expect(sourceCtx.tabs["tab-main"]).toBe(undefined);
    expect(sourceCtx.tabOrder.includes("tab-main")).toBe(false);

    // Target should have the tab
    const targetCtx = result.state.workspaces[targetId].contextState;
    expect(targetCtx.tabs["tab-main"] !== undefined).toBe(true);
    expect(targetCtx.tabOrder.includes("tab-main")).toBe(true);
  });

  it("moveTabToWorkspace removes from source dock tree adds to target", () => {
    // Create a state with a tab registered in dock tree
    let ctx = createInitialShellContextState();
    ctx = registerTab(ctx, {
      tabId: "extra-tab",
      definitionId: "extra",
      groupId: "group-main",
      closePolicy: "closeable",
    });

    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    const targetId = state.workspaceOrder[1];

    const result = moveTabToWorkspace(state, "extra-tab", "1", targetId, ctx);
    expect(result.changed).toBe(true);

    // Verify target dock tree has the tab
    const targetDock = result.state.workspaces[targetId].contextState.dockTree;
    expect(targetDock.root !== null).toBe(true);
  });

  it("moveTabToWorkspace no-op for same workspace", () => {
    const ctx = createInitialShellContextState();
    const state = createInitialWorkspaceManagerState(ctx);
    const result = moveTabToWorkspace(state, "tab-main", "1", "1", ctx);
    expect(result.changed).toBe(false);
  });

  it("moveTabToWorkspace no-op for nonexistent tab", () => {
    const ctx = createInitialShellContextState();
    let state = createInitialWorkspaceManagerState(ctx);
    state = createWorkspace(state).state;
    const targetId = state.workspaceOrder[1];
    const result = moveTabToWorkspace(state, "nonexistent", "1", targetId, ctx);
    expect(result.changed).toBe(false);
  });
});
