import { describe, expect, it } from "vitest";
import { createInitialShellContextState } from "../context-state.js";
import type { RuntimeEventHandlers } from "../shell-runtime/runtime-event-handlers.js";
import { createShellCoreApi } from "./shell-core.js";
import type { ShellRuntime } from "./types.js";

function createTestRuntime(): ShellRuntime {
  return {
    selectedPartId: "tab-main",
    selectedPartTitle: "Main",
    notice: "",
    pluginNotice: "",
    intentNotice: "",
    actionNotice: "",
    activeIntentSession: null,
    lastIntentTrace: null,
    contextState: createInitialShellContextState({
      initialTabId: "tab-main",
      initialGroupId: "group-main",
      initialGroupColor: "#4f46e5",
    }),
  } as unknown as ShellRuntime;
}

function createTestHandlers(runtime: ShellRuntime): RuntimeEventHandlers {
  return {
    applyContext: () => {
      runtime.notice = "context-applied";
    },
    applySelection: (event) => {
      runtime.selectedPartId = event.selectedPartId;
      runtime.selectedPartTitle = event.selectedPartTitle;
      runtime.notice = "selection-applied";
    },
    resolveIntentFlow: (intent) => {
      runtime.intentNotice = `intent:${intent.type}`;
    },
    executeResolvedAction: async (match) => {
      runtime.actionNotice = `executed:${match.title}`;
    },
  };
}

describe("shell-core", () => {
  it("shell core returns snapshot and notifies subscribers", async () => {
    const runtime = createTestRuntime();
    const core = createShellCoreApi(runtime, createTestHandlers(runtime));
    let notifications = 0;
    let lastNotice = "";

    const unsubscribe = core.subscribe((snapshot) => {
      notifications += 1;
      lastNotice = snapshot.notice;
    });

    core.applyContext({
      type: "context",
      scope: "global",
      contextKey: "k",
      contextValue: "v",
      sourceWindowId: "w1",
    });

    const afterContext = core.getSnapshot();
    expect(afterContext.notice).toBe("context-applied");
    expect(lastNotice).toBe("context-applied");

    core.resolveIntentFlow({ type: "open-order", facts: {} });
    const afterIntent = core.getSnapshot();
    expect(afterIntent.intentNotice).toBe("intent:open-order");

    await core.executeResolvedAction(
      {
        pluginId: "demo.plugin",
        pluginName: "Demo",
        actionId: "open",
        title: "Open",
        handler: "open",
        intentType: "open-order",
        when: {},
        loadStrategy: "eager",
        registrationOrder: 0,
        sortKey: "demo.plugin::open::open::0",
      },
      null,
    );

    const afterExecute = core.getSnapshot();
    expect(afterExecute.actionNotice).toBe("executed:Open");

    unsubscribe();
    core.applySelection({
      type: "selection",
      selectedPartId: "tab-secondary",
      selectedPartTitle: "Secondary",
      sourceWindowId: "w2",
      selectionByEntityType: {},
    });

    expect(notifications).toBe(3);
  });
});
