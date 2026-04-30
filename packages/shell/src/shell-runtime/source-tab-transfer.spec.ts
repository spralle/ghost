import { describe, expect, it } from "vitest";
import type { DndSessionDeleteEvent, DndSessionUpsertEvent } from "@ghost-shell/bridge";
import type { ShellRuntime } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { createInitialShellContextState, registerTab, type ShellContextState, setActiveTab } from "../context-state.js";
import { applySourceTabTransferTerminal, beginSourceTabTransferPending } from "./source-tab-transfer.js";

function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, {
    tabId: "tab-b",
    groupId: "group-main",
    tabLabel: "Tab B",
    closePolicy: "closeable",
  });
  state = setActiveTab(state, "tab-b");

  return {
    windowId: "window-a",
    selectedPartId: "tab-b",
    selectedPartTitle: "Tab B",
    contextState: state,
    sourceTabTransferPendingBySessionId: new Map(),
    sourceTabTransferTerminalSessionIds: new Set(),
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;
}

function createConsumeEvent(id: string, tabId: string): DndSessionUpsertEvent {
  return {
    type: "dnd-session-upsert",
    id,
    payload: {
      kind: "shell-tab-dnd",
      tabId,
      sourceWindowId: "window-a",
    },
    expiresAt: Date.now() + 10_000,
    lifecycle: "consume",
    ownerWindowId: "window-a",
    consumedByWindowId: "window-b",
    sourceWindowId: "window-b",
  };
}

function createTerminalEvent(id: string, lifecycle: "commit" | "abort" | "timeout"): DndSessionDeleteEvent {
  return {
    type: "dnd-session-delete",
    id,
    lifecycle,
    ownerWindowId: "window-a",
    consumedByWindowId: "window-b",
    sourceWindowId: "window-b",
  };
}

describe("source tab transfer", () => {
  it("source transfer removes source tab only after commit terminal", () => {
    const runtime = createRuntime();
    const beforeOrder = runtime.contextState.tabOrder.join(",");

    beginSourceTabTransferPending(runtime, createConsumeEvent("session-1", "tab-b"));
    expect(runtime.contextState.tabs["tab-b"]?.id).toBe("tab-b");

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-1", "commit"));
    expect(runtime.contextState.tabs["tab-b"]).toBe(undefined);

    const orderAfterCommit = runtime.contextState.tabOrder.join(",");
    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-1", "commit"));
    expect(runtime.contextState.tabOrder.join(",")).toBe(orderAfterCommit);
    expect(beforeOrder.includes("tab-b")).toBe(true);
  });

  it("source transfer abort restores active selection deterministically", () => {
    const runtime = createRuntime();

    beginSourceTabTransferPending(runtime, createConsumeEvent("session-2", "tab-b"));
    updateContextState(runtime, setActiveTab(runtime.contextState, "tab-a"));
    runtime.selectedPartId = "tab-a";
    runtime.selectedPartTitle = "tab-a";

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-2", "abort"));

    expect(runtime.contextState.tabs["tab-b"]?.id).toBe("tab-b");
    expect(runtime.contextState.activeTabId).toBe("tab-b");
    expect(runtime.selectedPartId).toBe("tab-b");
    expect(runtime.selectedPartTitle).toBe("Tab B");
  });

  it("source transfer timeout rollback is idempotent and ignores late consume", () => {
    const runtime = createRuntime();

    beginSourceTabTransferPending(runtime, createConsumeEvent("session-3", "tab-b"));
    updateContextState(runtime, setActiveTab(runtime.contextState, "tab-a"));
    runtime.selectedPartId = "tab-a";
    runtime.selectedPartTitle = "tab-a";

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-3", "timeout"));

    expect(runtime.contextState.tabs["tab-b"]?.id).toBe("tab-b");
    expect(runtime.contextState.activeTabId).toBe("tab-b");
    expect(runtime.sourceTabTransferPendingBySessionId?.size).toBe(0);

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-3", "timeout"));
    beginSourceTabTransferPending(runtime, createConsumeEvent("session-3", "tab-b"));

    expect(runtime.sourceTabTransferPendingBySessionId?.size).toBe(0);
    expect(runtime.contextState.tabs["tab-b"]?.id).toBe("tab-b");
  });

  it("late commit event before pending is ignored and future pending is blocked", () => {
    const runtime = createRuntime();

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-late", "commit"));
    beginSourceTabTransferPending(runtime, createConsumeEvent("session-late", "tab-b"));

    expect(runtime.sourceTabTransferPendingBySessionId?.size).toBe(0);
    expect(runtime.contextState.tabs["tab-b"]?.id).toBe("tab-b");
  });
});
