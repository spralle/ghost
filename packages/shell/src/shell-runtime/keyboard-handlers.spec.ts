import { describe, expect, it } from "vitest";
import { createInitialWorkspaceManagerState } from "@ghost-shell/state";
import { buildActionSurface } from "../action-surface.js";
import type { ShellRuntime } from "../app/types.js";
import { createInitialShellContextState, registerTab, setActiveTab } from "../context-state.js";
import {
  createDefaultShellKeybindingContract,
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
  DEFAULT_SHELL_KEYBINDINGS,
} from "./default-shell-keybindings.js";
import { bindKeyboardShortcuts, type KeyboardBindings } from "./keyboard-handlers.js";

class FakeRoot {
  private onKeyDown: ((event: KeyboardEvent) => Promise<void>) | null = null;

  addEventListener(name: string, listener: EventListenerOrEventListenerObject): void {
    if (name !== "keydown" || typeof listener !== "function") {
      return;
    }

    this.onKeyDown = listener as unknown as (event: KeyboardEvent) => Promise<void>;
  }

  removeEventListener(name: string): void {
    if (name === "keydown") {
      this.onKeyDown = null;
    }
  }

  querySelector<T>(): T | null {
    return null;
  }

  querySelectorAll<T>(): T[] {
    return [];
  }

  async dispatch(input: {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    target: EventTarget;
  }): Promise<{ prevented: boolean }> {
    if (!this.onKeyDown) {
      throw new Error("keydown listener not registered");
    }

    let prevented = false;
    const event = {
      key: input.key,
      ctrlKey: input.ctrlKey ?? false,
      altKey: input.altKey ?? false,
      shiftKey: input.shiftKey ?? false,
      metaKey: false,
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

describe("keyboard handlers", () => {
  it("keyboard handler resolves browser-safe shell keybinding and executes action path", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    const bindings = createBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    const result = await root.dispatch({
      key: "q",
      altKey: true,
      shiftKey: true,
      target,
    });

    expect(result.prevented).toBe(true);
    expect(runtime.contextState.tabs["tab-a"]).toBe(undefined);
    expect(runtime.actionNotice.includes("shell.view.close")).toBeTruthy();

    dispose();
  });

  it("keyboard handler blocks command when activation boundary rejects plugin", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    let activationCalls = 0;
    const bindings = createBindings(runtime, {
      activatePluginForBoundary: async () => {
        activationCalls += 1;
        return false;
      },
    });
    bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    const result = await root.dispatch({
      key: "q",
      altKey: true,
      shiftKey: true,
      target,
    });

    expect(result.prevented).toBe(false);
    expect(activationCalls).toBe(1);
    expect(runtime.actionNotice.includes("blocked")).toBeTruthy();
    expect(runtime.actionNotice.includes("com.ghost.shell.keybindings.default")).toBeTruthy();
  });

  it("keyboard handler resolves keybinding when target is not an HTMLElement (Bug B)", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    const bindings = createBindings(runtime);
    bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    // Use a plain object as target to simulate SVG/shadow DOM element
    const nonHtmlTarget = { tagName: "svg" } as unknown as EventTarget;
    const result = await root.dispatch({
      key: "q",
      altKey: true,
      shiftKey: true,
      target: nonHtmlTarget,
    });

    expect(result.prevented).toBe(true);
    expect(runtime.contextState.tabs["tab-a"]).toBe(undefined);
    expect(runtime.actionNotice.includes("shell.view.close")).toBeTruthy();
  });

  it("keyboard handler does not preventDefault for unavailable shell actions (Bug C)", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    // shell.window.mode.toggle is no longer in DEFAULT_SHELL_KEYBINDINGS, so provide
    // the binding via user override to test the no-op handler path.
    const bindings = createBindings(runtime, {
      getUserOverrideKeybindings: () => [
        { action: "shell.window.mode.toggle", keybinding: "shift+alt+m", pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID },
      ],
    });
    bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    // shift+alt+m triggers shell.window.mode.toggle which is always unavailable
    const result = await root.dispatch({
      key: "m",
      altKey: true,
      shiftKey: true,
      target,
    });

    expect(result.prevented).toBe(false);
    expect(runtime.actionNotice.includes("shell.window.mode.toggle")).toBeTruthy();
    expect(runtime.actionNotice.includes("no-op")).toBeTruthy();
  });

  it("keyboard handler invalidates cache when override content changes but count stays the same (Bug A)", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    let overrideSet: { action: string; keybinding: string; pluginId: string }[] = [
      { action: "shell.view.close", keybinding: "shift+alt+z", pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID },
    ];
    const bindings = createBindings(runtime, {
      getUserOverrideKeybindings: () => overrideSet,
    });
    bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();

    // First dispatch with override chord shift+alt+z — should resolve and close tab-a
    const result1 = await root.dispatch({ key: "z", altKey: true, shiftKey: true, target });
    expect(result1.prevented).toBe(true);
    expect(runtime.contextState.tabs["tab-a"]).toBe(undefined);

    // Now change override to different chord (same count=1) — remap close to shift+alt+x
    overrideSet = [
      { action: "shell.view.close", keybinding: "shift+alt+x", pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID },
    ];

    // The old override chord should no longer resolve (defaults don't have shift+alt+z)
    const resultOld = await root.dispatch({ key: "z", altKey: true, shiftKey: true, target });
    expect(resultOld.prevented).toBe(false);

    // The new override chord should resolve
    const resultNew = await root.dispatch({ key: "x", altKey: true, shiftKey: true, target });
    expect(resultNew.prevented).toBe(true);
    expect(runtime.actionNotice.includes("shell.view.close")).toBeTruthy();
  });

  it("escape key cancels pending chord sequence", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    // Set up a multi-chord binding: ctrl+k ctrl+c → shell.view.close
    const bindings = createBindings(runtime, {
      getDefaultKeybindings: () => [
        { action: "shell.view.close", keybinding: "ctrl+k ctrl+c", pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID },
      ],
    });
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();

    // Press first chord of sequence (ctrl+k) — should enter pending state
    const result1 = await root.dispatch({ key: "k", ctrlKey: true, target });
    expect(result1.prevented).toBe(true);

    // Press Escape — should cancel the pending sequence
    const result2 = await root.dispatch({ key: "Escape", target });
    expect(result2.prevented).toBe(true);

    // Now press ctrl+c — should NOT resolve the multi-chord binding
    // (sequence was cancelled, so ctrl+c alone shouldn't match ctrl+k ctrl+c)
    const result3 = await root.dispatch({ key: "c", ctrlKey: true, target });
    expect(result3.prevented).toBe(false);

    dispose();
  });

  it("keyboard handler routes workspace delete to runtime action registry", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    let calls = 0;
    runtime.runtimeActionRegistry.set("shell.workspace.delete", () => {
      calls += 1;
      return true;
    });
    const bindings = createBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    const result = await root.dispatch({
      key: "w",
      ctrlKey: true,
      altKey: true,
      target,
    });

    expect(result.prevented).toBe(true);
    expect(calls).toBe(1);
    expect(runtime.actionNotice.includes("shell.workspace.delete")).toBeTruthy();

    dispose();
  });
});

function createRuntimeFixture(): ShellRuntime {
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
  contextState = setActiveTab(contextState, "tab-a");

  return {
    actionSurface: buildActionSurface([createDefaultShellKeybindingContract()]),
    announcement: "",
    bridge: { publish: () => true } as unknown as ShellRuntime["bridge"],
    activeIntentSession: null,
    closeableTabIds: new Set(["tab-a", "tab-b"]),
    actionNotice: "",
    contextPersistence: { save: () => ({ warning: null }) },
    contextState,
    hostWindowId: null,
    incomingTransferJournal: { bySessionId: {} },
    intentRuntime: {
      async resolve() {
        return {
          kind: "no-match",
          feedback: "unused",
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
    registry: { getSnapshot: () => ({ plugins: [] }) } as unknown as ShellRuntime["registry"],
    runtimeActionRegistry: new Map(),
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    sourceTabTransferPendingBySessionId: new Map(),
    sourceTabTransferTerminalSessionIds: new Set(),
    syncDegraded: false,
    syncDegradedReason: null,
    syncHealthState: "healthy",
    windowId: "window-a",
    workspaceManager: createInitialWorkspaceManagerState(contextState),
  } as unknown as ShellRuntime;
}

function createBindings(runtime: ShellRuntime, overrides: Partial<KeyboardBindings> = {}): KeyboardBindings {
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
