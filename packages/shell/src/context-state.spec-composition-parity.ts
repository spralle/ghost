import { createIntentRuntime } from "@ghost-shell/intents";
import { createShellCoreApi } from "./app/shell-core.js";
import type { ShellRuntime } from "./app/types.js";
import { createInitialShellContextState, registerTab, type ShellContextState } from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { createContract } from "./context-state.spec-intent-runtime-fixtures.js";
import { dismissIntentChooser } from "./shell-runtime/keyboard-handlers.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";
import { createWorkspacePersistenceFixture } from "./test-fixtures/workspace-persistence-fixture.js";
import type { PartLifecycleDeps } from "./ui/part-instance-tab-lifecycle.js";
import { closeTabThroughRuntime, reopenMostRecentlyClosedTabThroughRuntime } from "./ui/part-instance-tab-lifecycle.js";
import { resolveClosedPopoutTransition } from "./ui/parts-controller-popout-transition.js";

type FlowMode = "baseline" | "contract";

type ParityStepSnapshot = {
  step: string;
  selectedPartId: string | null;
  activeTabId: string | null;
  tabOrder: string;
  pendingIntentMatches: number;
  intentNotice: string;
  syncDegraded: boolean;
  notice: string;
  poppedOut: string;
  enabledPlugins: string;
  publishedEvents: string;
};

type RuntimeDriver = {
  applySelection: Parameters<ReturnType<typeof createRuntimeEventHandlers>["applySelection"]>[0] extends infer T
    ? (event: T) => void
    : never;
  resolveIntentFlow: (intent: { type: string; facts: Record<string, string> }) => void;
};

interface MutablePluginRecord {
  readonly id: string;
  enabled: boolean;
  readonly contract: {
    manifest: { id: string; name: string; version: string };
    contributes: {
      actions: {
        id: string;
        title: string;
        handler: string;
        intent: string;
        when: Record<string, unknown>;
      }[];
    };
  };
}

export function registerCompositionParitySpecs(harness: SpecHarness): void {
  const { test } = harness;

  test("baseline and contract-driven composition produce parity transcripts for key shell flows", () => {
    const baselineTranscript = runParityFlow("baseline");
    const contractTranscript = runParityFlow("contract");

    if (baselineTranscript.length !== contractTranscript.length) {
      throw new Error(
        `parity transcript length mismatch baseline=${baselineTranscript.length} contract=${contractTranscript.length}`,
      );
    }

    for (let index = 0; index < baselineTranscript.length; index += 1) {
      const baseline = baselineTranscript[index];
      const contract = contractTranscript[index];
      const baselineSerialized = JSON.stringify(baseline);
      const contractSerialized = JSON.stringify(contract);
      if (baselineSerialized !== contractSerialized) {
        throw new Error(
          `parity mismatch at step '${baseline.step}'\n` +
            `baseline=${baselineSerialized}\n` +
            `contract=${contractSerialized}`,
        );
      }
    }
  });
}

function runParityFlow(mode: FlowMode): ParityStepSnapshot[] {
  const pluginRecords: MutablePluginRecord[] = [
    {
      id: "ghost.intent.a",
      enabled: true,
      contract: {
        manifest: {
          id: "ghost.intent.a",
          name: "Intent A",
          version: "0.1.0",
        },
        contributes: {
          actions: [
            {
              id: "open-a",
              title: "Open A",
              handler: "openA",
              intent: "intent.open-order",
              when: {},
            },
          ],
        },
      },
    },
    {
      id: "ghost.intent.b",
      enabled: true,
      contract: {
        manifest: {
          id: "ghost.intent.b",
          name: "Intent B",
          version: "0.1.0",
        },
        contributes: {
          actions: [
            {
              id: "open-b",
              title: "Open B",
              handler: "openB",
              intent: "intent.open-order",
              when: {},
            },
          ],
        },
      },
    },
  ];

  const runtime = createRuntimeFixture(pluginRecords);
  const publishedEvents: string[] = [];
  const root = createRootStub();
  const driver = createDriver(mode, root, runtime);
  const transcript: ParityStepSnapshot[] = [];

  const lifecycleDeps: PartLifecycleDeps = {
    applySelection: driver.applySelection,
    publishWithDegrade: (event) => {
      const suffix = "tabId" in event ? event.tabId : "selectedPartId" in event ? event.selectedPartId : "";
      publishedEvents.push(`${event.type}:${suffix}`);
    },
    renderContextControls: () => {},
    renderParts: () => {},
    renderSyncStatus: () => {},
  };

  captureSnapshot("start");

  driver.applySelection({
    type: "selection",
    selectedPartId: "tab-b",
    selectedPartTitle: "Orders",
    selectionByEntityType: {
      order: {
        selectedIds: ["order-1"],
        priorityId: "order-1",
      },
    },
    sourceWindowId: runtime.windowId,
  });
  captureSnapshot("tab-lifecycle/select");

  const closed = closeTabThroughRuntime(runtime, "tab-b", lifecycleDeps);
  if (!closed) {
    throw new Error("close tab flow did not close expected tab");
  }
  captureSnapshot("tab-lifecycle/close");

  const reopened = reopenMostRecentlyClosedTabThroughRuntime(runtime, lifecycleDeps);
  if (!reopened) {
    throw new Error("reopen tab flow did not reopen expected tab");
  }
  captureSnapshot("tab-lifecycle/reopen");

  withElementClass(() => {
    driver.resolveIntentFlow({
      type: "intent.open-order",
      facts: {
        source: "parity-test",
      },
    });
  });
  captureSnapshot("chooser/open");

  dismissIntentChooser(runtime, {
    announce: () => {},
    renderSyncStatus: () => {},
  });
  captureSnapshot("chooser/dismiss");

  pluginRecords[1].enabled = false;
  runtime.pluginNotice = "Plugin ghost.intent.b disabled for parity toggle";
  captureSnapshot("plugin-toggle/disable-b");

  runtime.poppedOutTabIds.add("tab-c");
  runtime.popoutHandles.set("tab-c", { closed: true } as Window);
  const transition = resolveClosedPopoutTransition({
    popoutHandles: runtime.popoutHandles,
    poppedOutTabIds: runtime.poppedOutTabIds,
  });
  for (const tabId of transition.closedHandleIds) {
    runtime.popoutHandles.delete(tabId);
  }
  for (const tabId of transition.restoredTabIds) {
    runtime.poppedOutTabIds.delete(tabId);
  }
  runtime.notice = `Restored ${transition.restoredTabIds.length} tab(s) after popout close.`;
  captureSnapshot("popout/restore");

  runtime.syncDegraded = true;
  runtime.syncDegradedReason = "channel-error";
  runtime.notice = "Sync degraded while probe pending.";
  captureSnapshot("sync/degraded");

  return transcript;

  function captureSnapshot(step: string): void {
    const enabledPluginIds = pluginRecords
      .filter((plugin) => plugin.enabled)
      .map((plugin) => plugin.id)
      .sort();
    transcript.push({
      step,
      selectedPartId: runtime.selectedPartId,
      activeTabId: runtime.contextState.activeTabId,
      tabOrder: runtime.contextState.tabOrder.join(","),
      pendingIntentMatches: runtime.activeIntentSession?.matches.length ?? 0,
      intentNotice: runtime.intentNotice,
      syncDegraded: runtime.syncDegraded,
      notice: runtime.notice,
      poppedOut: [...runtime.poppedOutTabIds].sort().join(","),
      enabledPlugins: enabledPluginIds.join(","),
      publishedEvents: publishedEvents.join("|"),
    });
  }
}

function createDriver(mode: FlowMode, root: HTMLElement, runtime: ShellRuntime): RuntimeDriver {
  const handlers = createRuntimeEventHandlers(root, runtime, {
    activatePluginForBoundary: async () => true,
    announce: () => {},
    renderContextControlsPanel: () => {},
    renderParts: () => {},
    renderSyncStatus: () => {},
    summarizeSelectionPriorities: () => "none",
  });

  if (mode === "baseline") {
    return {
      applySelection: (event) => handlers.applySelection(event),
      resolveIntentFlow: (intent) => handlers.resolveIntentFlow(intent),
    };
  }

  const core = createShellCoreApi(runtime, handlers);
  return {
    applySelection: (event) => core.applySelection(event),
    resolveIntentFlow: (intent) => core.resolveIntentFlow(intent),
  };
}

function createRuntimeFixture(pluginRecords: MutablePluginRecord[]): ShellRuntime {
  let contextState: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-b",
    groupId: "group-main",
    tabLabel: "Orders",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-c",
    groupId: "group-main",
    tabLabel: "Vessels",
  });

  return {
    windowId: "window-main",
    selectedPartId: "tab-a",
    selectedPartTitle: "Home",
    contextState,
    ...createWorkspacePersistenceFixture(contextState),
    notice: "",
    pluginNotice: "",
    intentNotice: "",
    intentRuntime: createIntentRuntime({
      getRegistrySnapshot: () => ({
        plugins: pluginRecords.map((plugin) => ({
          id: plugin.id,
          enabled: plugin.enabled,
          loadStrategy: "local",
          contract: createContract(plugin.contract),
        })),
      }),
    }),
    actionNotice: "",
    activeIntentSession: null,
    lastIntentTrace: null,
    pendingFocusSelector: null,
    closeableTabIds: new Set(["tab-a", "tab-b", "tab-c"]),
    poppedOutTabIds: new Set<string>(),
    popoutHandles: new Map<string, Window>(),
    syncDegraded: false,
    syncDegradedReason: null,
    contextPersistence: {
      save(nextState: ShellContextState) {
        contextState = nextState;
        return { warning: null };
      },
      load(fallbackState: ShellContextState) {
        return { state: fallbackState, warning: null };
      },
    },
    registry: {
      getSnapshot() {
        return {
          plugins: pluginRecords.map((plugin) => ({
            id: plugin.id,
            enabled: plugin.enabled,
            loadStrategy: "local",
            contract: plugin.contract,
          })),
        };
      },
    },
  } as unknown as ShellRuntime;
}

function createRootStub(): HTMLElement {
  return {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    ownerDocument: {
      activeElement: null,
    },
  } as unknown as HTMLElement;
}

function withElementClass(run: () => void): void {
  const scope = globalThis as typeof globalThis & { HTMLElement?: typeof HTMLElement };
  const existing = scope.HTMLElement;
  class TestElement {}
  scope.HTMLElement = TestElement as unknown as typeof HTMLElement;
  try {
    run();
  } finally {
    if (existing) {
      scope.HTMLElement = existing;
    } else {
      Reflect.deleteProperty(scope as Record<string, unknown>, "HTMLElement");
    }
  }
}
