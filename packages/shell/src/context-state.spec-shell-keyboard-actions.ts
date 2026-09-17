import { type ActionSurface, buildActionSurface } from "./action-surface.js";
import type { ShellRuntime } from "./app/types.js";
import {
  createInitialShellContextState,
  moveTabInDockTree,
  registerTab,
  type ShellContextState,
  setActiveTab,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import {
  createDefaultShellKeybindingContract,
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
  DEFAULT_SHELL_KEYBINDINGS,
  isBrowserSafeDefaultKeybinding,
} from "./shell-runtime/default-shell-keybindings.js";
import { bindKeyboardShortcuts, type KeyboardBindings } from "./shell-runtime/keyboard-handlers.js";
import { createWorkspacePersistenceFixture } from "./test-fixtures/workspace-persistence-fixture.js";

type KeydownListener = (event: KeyboardEvent) => Promise<void>;

class FakeRoot {
  private onKeyDown: KeydownListener | null = null;

  addEventListener(eventName: string, listener: EventListenerOrEventListenerObject): void {
    if (eventName !== "keydown" || typeof listener !== "function") {
      return;
    }

    this.onKeyDown = listener as unknown as KeydownListener;
  }

  removeEventListener(eventName: string): void {
    if (eventName === "keydown") {
      this.onKeyDown = null;
    }
  }

  querySelector<T>(): T | null {
    return null;
  }

  querySelectorAll<T>(): T[] {
    return [];
  }

  async dispatchKey(input: {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    target: HTMLElement;
  }): Promise<{ prevented: boolean }> {
    if (!this.onKeyDown) {
      throw new Error("keydown listener not bound");
    }

    let prevented = false;
    const event = {
      key: input.key,
      ctrlKey: input.ctrlKey ?? false,
      altKey: input.altKey ?? false,
      shiftKey: input.shiftKey ?? false,
      metaKey: input.metaKey ?? false,
      target: input.target,
      preventDefault() {
        prevented = true;
      },
    } as unknown as KeyboardEvent;

    await this.onKeyDown(event);
    return { prevented };
  }
}

class FakeElement {
  dataset: Record<string, string> = {};
}

export function registerShellKeyboardActionSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("default shell keybindings remain browser-safe and non-meta", () => {
    const uniqueKeys = new Set<string>();
    for (const binding of DEFAULT_SHELL_KEYBINDINGS) {
      assertEqual(isBrowserSafeDefaultKeybinding(binding.keybinding), true, `${binding.action} should be browser-safe`);
      assertEqual(binding.keybinding.includes("meta"), false, `${binding.action} should not require meta`);
      uniqueKeys.add(binding.keybinding);
    }

    assertEqual(uniqueKeys.size, DEFAULT_SHELL_KEYBINDINGS.length, "default shell keybindings should not collide");
  });

  test("keyboard dispatch executes directional focus and resize transitions", async () => {
    const root = new FakeRoot();
    const runtime = createKeyboardRuntimeFixture();
    const bindings = createKeyboardBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    const beforeFocus = runtime.contextState.activeTabId;
    await root.dispatchKey({ key: "ArrowRight", altKey: true, shiftKey: true, target });
    assertEqual(beforeFocus, "tab-a", "fixture should start focused on left tab");
    assertEqual(runtime.contextState.activeTabId, "tab-b", "focus-right shortcut should activate right stack tab");

    runtime.contextState = setActiveTab(runtime.contextState, "tab-a");
    const beforeRatio = readRootSplitRatio(runtime.contextState);
    await root.dispatchKey({ key: "ArrowRight", ctrlKey: true, shiftKey: true, target });
    const afterRatio = readRootSplitRatio(runtime.contextState);
    assertTruthy(beforeRatio !== null && afterRatio !== null, "fixture should contain split root for resize");
    assertEqual(afterRatio, 0.55, "resize-right shortcut should grow active first branch ratio");

    dispose();
  });

  test("keyboard dispatch executes move/swap and cycles group/stack", async () => {
    const target = ensureDomElement();

    const moveRoot = new FakeRoot();
    const moveRuntime = createKeyboardRuntimeFixture();
    const moveBindings = createKeyboardBindings(moveRuntime);
    const disposeMove = bindKeyboardShortcuts(moveRoot as unknown as HTMLElement, moveRuntime, moveBindings);
    await moveRoot.dispatchKey({ key: "ArrowRight", ctrlKey: true, altKey: true, target });
    assertEqual(moveRuntime.contextState.activeTabId, "tab-a", "move-right should keep moved tab active");
    assertEqual(
      isTabInRightStack(moveRuntime.contextState, "tab-a"),
      true,
      "move-right should place active tab in right stack",
    );
    disposeMove();

    const swapRoot = new FakeRoot();
    const swapRuntime = createKeyboardRuntimeFixture();
    const swapBindings = createKeyboardBindings(swapRuntime);
    const disposeSwap = bindKeyboardShortcuts(swapRoot as unknown as HTMLElement, swapRuntime, swapBindings);
    await swapRoot.dispatchKey({ key: "ArrowRight", ctrlKey: true, altKey: true, shiftKey: true, target });
    assertEqual(swapRuntime.contextState.activeTabId, "tab-a", "swap-right should keep source tab active");
    disposeSwap();

    const groupRoot = new FakeRoot();
    const groupRuntime = createKeyboardRuntimeFixture();
    const groupBindings = createKeyboardBindings(groupRuntime);
    const disposeGroup = bindKeyboardShortcuts(groupRoot as unknown as HTMLElement, groupRuntime, groupBindings);
    await groupRoot.dispatchKey({ key: "g", altKey: true, shiftKey: true, target });
    assertEqual(
      groupRuntime.contextState.tabs[groupRuntime.contextState.activeTabId ?? ""]?.groupId,
      "group-b",
      "group-cycle next should focus next group tab",
    );
    disposeGroup();

    const stackRoot = new FakeRoot();
    const stackRuntime = createKeyboardRuntimeFixture();
    const stackBindings = createKeyboardBindings(stackRuntime);
    const disposeStack = bindKeyboardShortcuts(stackRoot as unknown as HTMLElement, stackRuntime, stackBindings);
    await stackRoot.dispatchKey({ key: "n", altKey: true, shiftKey: true, target });
    assertEqual(stackRuntime.contextState.activeTabId, "tab-d", "stack-cycle next should focus next tab in stack");
    disposeStack();
  });

  test("keyboard dispatch emits explicit no-op for unavailable actions", async () => {
    const root = new FakeRoot();
    const runtime = createKeyboardRuntimeFixture();
    // shell.window.mode.toggle no longer has a default keybinding;
    // provide it via user override to test the no-op path.
    const bindings = createKeyboardBindings(runtime, {
      getUserOverrideKeybindings: () => [
        { action: "shell.window.mode.toggle", keybinding: "shift+alt+m", pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID },
      ],
    });
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);
    const target = ensureDomElement();

    await root.dispatchKey({ key: "m", altKey: true, shiftKey: true, target });
    assertTruthy(runtime.actionNotice.includes("no-op"), "mode toggle shortcut should report explicit no-op notice");

    await root.dispatchKey({ key: "q", altKey: true, shiftKey: true, target });
    assertEqual(runtime.contextState.tabs["tab-a"], undefined, "close shortcut should close active tab");

    dispose();
  });

  test("fullscreen toggle keybinding is dispatched and not unavailable", async () => {
    const root = new FakeRoot();
    const runtime = createKeyboardRuntimeFixture();
    const bindings = createKeyboardBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);
    const target = ensureDomElement();

    // fullscreen.toggle is no longer in SHELL_UNAVAILABLE_ACTION_IDS so its
    // default keybinding (shift+alt+f) is active and reaches the handler.
    // In Node tests there is no real document, so the handler returns a
    // graceful no-op ("not in browser environment") — but it should NOT
    // report "action unavailable in browser shell runtime" (the old guard).
    const activeBefore = runtime.contextState.activeTabId;
    await root.dispatchKey({ key: "f", altKey: true, shiftKey: true, target });

    assertEqual(runtime.contextState.activeTabId, activeBefore, "fullscreen toggle should not change active tab");
    assertTruthy(
      runtime.actionNotice.includes("shell.window.fullscreen.toggle"),
      "fullscreen toggle should be referenced in action notice",
    );
    assertTruthy(
      !runtime.actionNotice.includes("action unavailable"),
      "fullscreen toggle should not report generic unavailable",
    );

    dispose();
  });

  test("equalize splits resets all ratios to 0.5", async () => {
    const root = new FakeRoot();
    const runtime = createKeyboardRuntimeFixture();
    const bindings = createKeyboardBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);
    const target = ensureDomElement();

    // Resize to change the ratio away from 0.5
    await root.dispatchKey({ key: "ArrowRight", ctrlKey: true, shiftKey: true, target });
    const ratioAfterResize = readRootSplitRatio(runtime.contextState);
    assertTruthy(ratioAfterResize !== null && ratioAfterResize !== 0.5, "resize should change ratio away from 0.5");

    // Equalize: shift+alt+e
    await root.dispatchKey({ key: "e", altKey: true, shiftKey: true, target });
    const ratioAfterEqualize = readRootSplitRatio(runtime.contextState);
    assertEqual(ratioAfterEqualize, 0.5, "equalize splits should reset ratio to 0.5");

    dispose();
  });

  test("tab-by-number activates Nth tab in active stack", async () => {
    const root = new FakeRoot();
    const runtime = createKeyboardRuntimeFixture();
    const bindings = createKeyboardBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);
    const target = ensureDomElement();

    // Fixture: tab-a is active in left stack, which also contains tab-d (added via center drop).
    // Left stack should be [tab-a, tab-d].
    assertEqual(runtime.contextState.activeTabId, "tab-a", "should start on tab-a");

    // alt+2 should switch to second tab in the active stack
    await root.dispatchKey({ key: "2", altKey: true, target });
    assertEqual(runtime.contextState.activeTabId, "tab-d", "alt+2 should activate second tab in stack");

    // alt+1 should switch back to first tab
    await root.dispatchKey({ key: "1", altKey: true, target });
    assertEqual(runtime.contextState.activeTabId, "tab-a", "alt+1 should activate first tab in stack");

    // alt+9 should be a no-op (no tab at position 9)
    await root.dispatchKey({ key: "9", altKey: true, target });
    assertEqual(runtime.contextState.activeTabId, "tab-a", "alt+9 should be no-op when no tab at that position");

    dispose();
  });
}

function createKeyboardRuntimeFixture(): ShellRuntime {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-a",
    initialGroupColor: "blue",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-b",
    groupId: "group-a",
    closePolicy: "closeable",
    tabLabel: "Tab B",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-c",
    groupId: "group-b",
    closePolicy: "closeable",
    tabLabel: "Tab C",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-d",
    groupId: "group-a",
    closePolicy: "closeable",
    tabLabel: "Tab D",
  });

  contextState = moveTabInDockTree(contextState, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
  contextState = moveTabInDockTree(contextState, { tabId: "tab-c", targetTabId: "tab-b", zone: "bottom" });
  contextState = moveTabInDockTree(contextState, { tabId: "tab-d", targetTabId: "tab-a", zone: "center" });
  contextState = setActiveTab(contextState, "tab-a");

  const actionSurface: ActionSurface = buildActionSurface([createDefaultShellKeybindingContract()]);

  return {
    actionSurface,
    announcement: "",
    bridge: { publish: () => true } as unknown as ShellRuntime["bridge"],
    activeIntentSession: null,
    closeableTabIds: new Set(["tab-a", "tab-b", "tab-c", "tab-d"]),
    actionNotice: "",
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
    contextState,
    ...createWorkspacePersistenceFixture(contextState),
    hostWindowId: null,
    incomingTransferJournal: { bySessionId: {} },
    intentRuntime: {
      async resolve() {
        return {
          kind: "no-match" as const,
          feedback: "unused intent runtime",
          trace: { intentType: "", evaluatedAt: 0, actions: [], matched: [] },
        };
      },
    },
    intentNotice: "",
    isPopout: false,
    lastIntentTrace: null,
    layout: { sideSize: 0.2, secondarySize: 0.3 },
    notice: "",
    partHost: { syncRenderedParts: async () => {}, unmountAll: () => {} } as ShellRuntime["partHost"],
    pendingFocusSelector: null,
    pendingProbeId: null,
    persistence: { save: () => ({ warning: null }), load: () => ({ sideSize: 0.2, secondarySize: 0.3 }) },
    pluginNotice: "",
    popoutHandles: new Map(),
    poppedOutTabIds: new Set(),
    popoutTabId: null,
    registry: {
      getSnapshot() {
        return { plugins: [] };
      },
    } as unknown as ShellRuntime["registry"],
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    sourceTabTransferPendingBySessionId: new Map(),
    sourceTabTransferTerminalSessionIds: new Set(),
    syncDegraded: false,
    syncDegradedReason: null,
    syncHealthState: "healthy",
    windowId: "window-a",
  } as unknown as ShellRuntime;
}

function createKeyboardBindings(runtime: ShellRuntime, overrides: Partial<KeyboardBindings> = {}): KeyboardBindings {
  return {
    activatePluginForBoundary: async () => true,
    announce: () => {},
    applySelection: () => {},
    dismissIntentChooser: () => {
      runtime.activeIntentSession = null;
    },
    executeResolvedAction: async () => {},
    publishWithDegrade: () => {},
    renderContextControls: () => {},
    renderEdgeSlots: () => {},
    renderParts: () => {},
    renderSyncStatus: () => {},
    getDefaultKeybindings: () =>
      DEFAULT_SHELL_KEYBINDINGS.map((entry) => ({
        action: entry.action,
        keybinding: entry.keybinding,
        pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      })),
    getUserOverrideKeybindings: () => [],
    getWorkspaceSwitchDeps: () => ({
      root: {} as HTMLElement,
      runtime,
      partsDeps: {
        applySelection: () => {},
        partHost: runtime.partHost,
        publishWithDegrade: () => {},
        renderContextControls: () => {},
        renderParts: () => {},
        renderSyncStatus: () => {},
      },
    }),
    toActionContext: () => ({
      "context.domain.selection": "none",
      "shell.group-context": "none",
      "selection.partInstanceId": runtime.contextState.activeTabId ?? "none",
    }),
    ...overrides,
  };
}

function ensureDomElement(): HTMLElement {
  if (!("HTMLElement" in globalThis)) {
    (globalThis as { HTMLElement?: typeof FakeElement }).HTMLElement = FakeElement;
  }

  return new (globalThis as { HTMLElement: new () => HTMLElement }).HTMLElement();
}

function readRootSplitRatio(state: ShellContextState): number | null {
  const root = state.dockTree.root;
  if (!root || root.kind !== "split") {
    return null;
  }

  return root.ratio ?? 0.5;
}

function isTabInRightStack(state: ShellContextState, tabId: string): boolean {
  const root = state.dockTree.root;
  if (!root || root.kind !== "split") {
    return false;
  }

  const rightBranch = root.second;
  if (rightBranch.kind === "stack") {
    return rightBranch.tabIds.includes(tabId);
  }

  return collectStackTabIds(rightBranch).includes(tabId);
}

function collectStackTabIds(node: ShellContextState["dockTree"]["root"]): string[] {
  if (!node) {
    return [];
  }

  if (node.kind === "stack") {
    return [...node.tabIds];
  }

  return [...collectStackTabIds(node.first), ...collectStackTabIds(node.second)];
}
