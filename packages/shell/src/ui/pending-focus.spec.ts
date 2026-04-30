import { describe, expect, it } from "vitest";
import type { ShellRuntime } from "../app/types.js";
import { createInitialShellContextState, registerTab, type ShellContextState } from "../context-state.js";
import { closeTabFromUi, reopenMostRecentlyClosedTabThroughRuntime } from "./parts-controller.js";
import { applyPendingFocus } from "./pending-focus.js";

describe("pending-focus", () => {
  it("close click flow persists context and applies/clears pending focus", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Bravo", closePolicy: "closeable" });
    state = registerTab(state, {
      tabId: "tab-c",
      groupId: "group-main",
      tabLabel: "Charlie",
      closePolicy: "closeable",
    });
    state = {
      ...state,
      activeTabId: "tab-b",
    };

    const persistCalls: ShellContextState[] = [];

    const runtime = {
      contextState: state,
      selectedPartId: "tab-b",
      selectedPartTitle: "Bravo",
      windowId: "window-a",
      pendingFocusSelector: null,
      notice: "",
      contextPersistence: {
        save(nextState: ShellContextState) {
          persistCalls.push(nextState);
          return { warning: null };
        },
      },
      workspacePersistence: {
        save() {
          return { warning: null };
        },
        load() {
          return { warning: null };
        },
      },
      workspaceManager: {},
      registry: {
        getSnapshot() {
          return {
            plugins: [],
          };
        },
      },
    } as unknown as ShellRuntime;

    const pendingSelector = closeTabFromUi(runtime, "tab-b");
    expect(runtime.contextState.tabs["tab-b"]).toBe(undefined);
    expect(runtime.contextState.activeTabId).toBe("tab-c");
    expect(pendingSelector).toBe("button[data-action='activate-tab'][data-part-id='tab-c']");
    expect(persistCalls.length >= 1).toBe(true);

    let focused = false;
    let cleared = false;
    const rootNode = {
      querySelector(selector: string) {
        if (selector !== pendingSelector) {
          return null;
        }

        return {
          focus() {
            focused = true;
          },
        };
      },
    };

    applyPendingFocus(rootNode, runtime.pendingFocusSelector, () => {
      runtime.pendingFocusSelector = null;
      cleared = true;
    });

    expect(focused).toBeTruthy();
    expect(cleared).toBeTruthy();
    expect(runtime.pendingFocusSelector).toBe(null);
  });

  it("reopen most recently closed tab restores tab and pending focus", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Bravo", closePolicy: "closeable" });
    state = {
      ...state,
      activeTabId: "tab-b",
    };

    const runtime = {
      contextState: state,
      selectedPartId: "tab-b",
      selectedPartTitle: "Bravo",
      windowId: "window-a",
      pendingFocusSelector: null,
      notice: "",
      syncDegraded: false,
      closeableTabIds: new Set(["tab-a", "tab-b"]),
      contextPersistence: {
        save() {
          return { warning: null };
        },
      },
      workspacePersistence: {
        save() {
          return { warning: null };
        },
        load() {
          return { warning: null };
        },
      },
      workspaceManager: {},
      registry: {
        getSnapshot() {
          return {
            plugins: [],
          };
        },
      },
    } as unknown as ShellRuntime;

    closeTabFromUi(runtime, "tab-b", {
      slot: "main",
      orderIndex: 1,
    });
    expect(runtime.contextState.tabs["tab-b"]).toBe(undefined);

    let applySelectionCalls = 0;
    let publishCalls = 0;
    const reopened = reopenMostRecentlyClosedTabThroughRuntime(runtime, {
      applySelection() {
        applySelectionCalls += 1;
      },
      publishWithDegrade() {
        publishCalls += 1;
      },
      renderContextControls() {},
      renderParts() {},
      renderSyncStatus() {},
    });

    expect(reopened).toBe(true);
    expect(runtime.contextState.tabs["tab-b"]?.label).toBe("Bravo");
    expect(runtime.contextState.activeTabId).toBe("tab-b");
    expect(runtime.pendingFocusSelector).toBe("button[data-action='activate-tab'][data-part-id='tab-b']");
    expect(applySelectionCalls).toBe(1);
    expect(publishCalls).toBe(1);
  });
});
