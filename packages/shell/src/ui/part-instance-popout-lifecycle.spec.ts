import { describe, expect, it } from "vitest";
import type { PluginServices } from "@ghost-shell/contracts";
import { createEventEmitter } from "@ghost-shell/plugin-system";
import type { ShellRuntime } from "../app/types.js";
import { createIncomingTransferJournal } from "../context-state.js";
import { dispatchLocalLifecycleAction } from "./part-instance-lifecycle-dispatch.js";
import { openPopout } from "./part-instance-popout-lifecycle.js";

type _WindowOpenFn = (url?: string | URL, target?: string) => Window | null;

type MinimalWindow = Pick<Window, "location" | "open" | "close"> & {
  __ghost?: Window["__ghost"];
};

function createStubPluginServices(): PluginServices {
  return {
    getService() {
      return null;
    },
    hasService() {
      return false;
    },
  };
}

describe("part instance popout lifecycle", () => {
  it("host injects ghost shim and nested host-open succeeds", () => {
    const openCalls: Array<{ url: string; target: string | undefined }> = [];
    const popoutA = {} as Window;
    const popoutB = {} as Window;
    const openQueue: Array<Window | null> = [popoutA, popoutB];
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
        open(url, target) {
          openCalls.push({
            url: String(url ?? ""),
            target,
          });
          return openQueue.shift() ?? null;
        },
        close() {
          // no-op
        },
      },
      () => {
        openPopout("part-a", runtime, deps);
        const shim = popoutA.__ghost;
        expect(shim).toBeTruthy();
        expect(typeof shim?.open).toBe("function");

        const nested = shim?.open({
          hostWindowId: "host-1",
          sourcePartId: "part-a",
          targetPartId: "part-b",
        });

        expect(nested?.status).toBe("opened");
        expect(runtime.poppedOutTabIds.has("part-b")).toBeTruthy();
        expect(openCalls.length).toBe(2);

        const nestedUrl = new URL(openCalls[1]?.url);
        expect(nestedUrl.searchParams.get("popout")).toBe("1");
        expect(nestedUrl.searchParams.get("partId")).toBe("part-b");
        expect(nestedUrl.searchParams.get("hostWindowId")).toBe("host-1");
      },
    );
  });

  it("popout fallback notice shown when host shim unavailable", () => {
    const runtime = createRuntime({
      isPopout: true,
      hostWindowId: "host-1",
      popoutTabId: "part-a",
      contextState: createContextState(["part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell?popout=1" } as Location,
        open() {
          return null;
        },
        close() {
          // no-op
        },
      },
      () => {
        const accepted = dispatchLocalLifecycleAction(
          runtime,
          {
            actionId: "part-instance.popout",
            tabInstanceId: "part-b",
          },
          deps,
        );

        expect(accepted).toBe(true);
        expect(runtime.notice.includes("Host popout bridge unavailable")).toBeTruthy();
        expect(deps.renderSyncStatusCalls).toBe(1);
        expect(runtime.poppedOutTabIds.size).toBe(0);
      },
    );
  });

  it("shim propagates popup blocked result without stale host state", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-c"]),
    });
    const deps = createDeps();

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
        open(url) {
          openCalls.push(String(url ?? ""));
          return openCalls.length === 1 ? popoutA : null;
        },
        close() {
          // no-op
        },
      },
      () => {
        openPopout("part-a", runtime, deps);
        const result = popoutA.__ghost?.open({
          hostWindowId: "host-1",
          sourcePartId: "part-a",
          targetPartId: "part-c",
        });

        expect(result?.status).toBe("blocked");
        expect(result?.notice.includes("Popup blocked")).toBeTruthy();
        expect(runtime.poppedOutTabIds.has("part-c")).toBe(false);
        expect(runtime.popoutHandles.has("part-c")).toBe(false);
      },
    );
  });

  it("host shim rejects ownership mismatch requests", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
        open(url) {
          openCalls.push(String(url ?? ""));
          return popoutA;
        },
        close() {
          // no-op
        },
      },
      () => {
        openPopout("part-a", runtime, deps);

        const result = popoutA.__ghost?.open({
          hostWindowId: "host-2",
          sourcePartId: "part-a",
          targetPartId: "part-b",
        });

        expect(result?.status).toBe("rejected");
        expect(result?.notice.includes("ownership mismatch")).toBeTruthy();
        expect(openCalls.length).toBe(1);
        expect(runtime.poppedOutTabIds.has("part-b")).toBe(false);
      },
    );
  });

  it("host shim rejects missing or unknown target part", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
        open(url) {
          openCalls.push(String(url ?? ""));
          return popoutA;
        },
        close() {
          // no-op
        },
      },
      () => {
        openPopout("part-a", runtime, deps);

        const missingTarget = popoutA.__ghost?.open({
          hostWindowId: "host-1",
          sourcePartId: "part-a",
          targetPartId: "",
        });
        const unknownTarget = popoutA.__ghost?.open({
          hostWindowId: "host-1",
          sourcePartId: "part-a",
          targetPartId: "part-missing",
        });

        expect(missingTarget?.status).toBe("rejected");
        expect(unknownTarget?.status).toBe("rejected");
        expect(unknownTarget?.notice.includes("target part not found")).toBeTruthy();
        expect(openCalls.length).toBe(1);
        expect(runtime.poppedOutTabIds.has("part-missing")).toBe(false);
      },
    );
  });

  it("host shim rejects target that is already popped out", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    runtime.poppedOutTabIds.add("part-b");
    runtime.popoutHandles.set("part-b", {} as Window);
    const deps = createDeps();

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
        open(url) {
          openCalls.push(String(url ?? ""));
          return popoutA;
        },
        close() {
          // no-op
        },
      },
      () => {
        openPopout("part-a", runtime, deps);

        const result = popoutA.__ghost?.open({
          hostWindowId: "host-1",
          sourcePartId: "part-a",
          targetPartId: "part-b",
        });

        expect(result?.status).toBe("rejected");
        expect(result?.notice.includes("already popped out")).toBeTruthy();
        expect(openCalls.length).toBe(1);
      },
    );
  });

  it("non-popout lifecycle dispatch still uses direct host open flow", () => {
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-main"]),
    });
    const deps = createDeps();
    let openCallCount = 0;

    runWithWindowStub(
      {
        location: { href: "https://ghost.local/shell" } as Location,
        open() {
          openCallCount += 1;
          return {} as Window;
        },
        close() {
          // no-op
        },
      },
      () => {
        const accepted = dispatchLocalLifecycleAction(
          runtime,
          {
            actionId: "part-instance.popout",
            tabInstanceId: "part-main",
          },
          deps,
        );

        expect(accepted).toBe(true);
        expect(openCallCount).toBe(1);
        expect(runtime.poppedOutTabIds.has("part-main")).toBe(true);
      },
    );
  });
});

function createRuntime(overrides: Partial<ShellRuntime>): ShellRuntime {
  const workspaceEvents = createEventEmitter<void>();
  return {
    windowId: "window-1",
    hostWindowId: null,
    popoutTabId: null,
    isPopout: false,
    notice: "",
    popoutHandles: new Map<string, Window>(),
    poppedOutTabIds: new Set<string>(),
    contextState: createContextState([]),
    selectedPartId: null,
    selectedPartTitle: null,
    layout: {} as ShellRuntime["layout"],
    persistence: {} as ShellRuntime["persistence"],
    contextPersistence: {} as ShellRuntime["contextPersistence"],
    keybindingPersistence: {} as ShellRuntime["keybindingPersistence"],
    workspacePersistence: {} as ShellRuntime["workspacePersistence"],
    keybindingOverrideManager: {} as ShellRuntime["keybindingOverrideManager"],
    registry: {} as ShellRuntime["registry"],
    bridge: {} as ShellRuntime["bridge"],
    asyncBridge: {} as ShellRuntime["asyncBridge"],
    closeableTabIds: new Set<string>(),
    dragSessionBroker: {} as ShellRuntime["dragSessionBroker"],
    incomingTransferJournal: createIncomingTransferJournal(),
    crossWindowDndEnabled: false,
    crossWindowDndKillSwitchActive: false,
    syncDegraded: false,
    syncHealthState: "healthy",
    syncDegradedReason: null,
    pendingProbeId: null,
    announcement: "",
    pendingFocusSelector: null,
    actionSurface: {} as ShellRuntime["actionSurface"],
    intentRuntime: {} as ShellRuntime["intentRuntime"],
    runtimeActionRegistry: new Map(),
    workspaceEvents: {
      fireDidChangeWorkspaces: () => workspaceEvents.fire(undefined),
      onDidChangeWorkspaces: workspaceEvents.event,
    },
    services: createStubPluginServices(),
    actionNotice: "",
    pluginNotice: "",
    intentNotice: "",
    activeIntentSession: null,
    lastIntentTrace: null,
    _pendingChooserResolve: null,
    partHost: null as unknown as ShellRuntime["partHost"],
    pluginConfigSyncDispose: null,
    activeTransportPath: "legacy-bridge",
    activeTransportReason: "default-legacy",
    activeDndPath: "same-window",
    activeDndReason: "default-same-window-only",
    lastDndDiagnostic: null,
    themeRegistry: null,
    workspaceManager: {} as ShellRuntime["workspaceManager"],
    placementRegistry: {} as ShellRuntime["placementRegistry"],
    placementConfig: {} as ShellRuntime["placementConfig"],
    elevatedSession: { active: false, activatedAt: null },
    ...overrides,
  };
}

function createDeps() {
  const deps = {
    renderContextControls() {
      // no-op
    },
    renderPartsCalls: 0,
    renderParts() {
      deps.renderPartsCalls += 1;
    },
    renderSyncStatusCalls: 0,
    renderSyncStatus() {
      deps.renderSyncStatusCalls += 1;
    },
    applySelection() {
      // no-op
    },
    publishWithDegrade() {
      // no-op
    },
  };

  return deps;
}

function createContextState(tabIds: string[]): ShellRuntime["contextState"] {
  const tabs: ShellRuntime["contextState"]["tabs"] = {};
  for (const tabId of tabIds) {
    tabs[tabId] = {
      id: tabId,
      definitionId: tabId,
      partDefinitionId: tabId,
      groupId: "group-main",
      label: tabId,
      closePolicy: "closeable",
      args: {},
    };
  }

  return {
    groups: {
      "group-main": {
        id: "group-main",
        color: "#336699",
      },
    },
    tabs,
    tabOrder: [...tabIds],
    activeTabId: tabIds[0] ?? null,
    dockTree: {
      root: {
        kind: "split",
        id: "dock-root",
        orientation: "horizontal",
        ratio: 0.5,
        first: {
          kind: "stack",
          id: "dock-stack",
          tabIds: [...tabIds],
          activeTabId: tabIds[0] ?? null,
        },
        second: {
          kind: "stack",
          id: "dock-empty",
          tabIds: [],
          activeTabId: null,
        },
      },
    },
    closedTabHistory: [],
    globalLanes: {},
    groupLanes: {},
    subcontextsByTab: {},
    selectionByEntityType: {},
  };
}

function runWithWindowStub(windowStub: MinimalWindow, run: () => void): void {
  const globalScope = globalThis as { window?: Window };
  const previousWindow = globalScope.window;
  globalScope.window = windowStub as Window;

  try {
    run();
  } finally {
    if (previousWindow) {
      globalScope.window = previousWindow;
    } else {
      delete globalScope.window;
    }
  }
}
