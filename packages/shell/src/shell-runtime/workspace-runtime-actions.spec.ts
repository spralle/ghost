import { describe, expect, it } from "vitest";
import { createEventEmitter } from "@ghost-shell/plugin-system";
import { createInitialWorkspaceManagerState } from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";
import { createInitialShellContextState } from "../context-state.js";
import type { WorkspaceSwitchDeps } from "../ui/workspace-switch.js";
import { registerWorkspaceRuntimeActions } from "./workspace-runtime-actions.js";

describe("workspace runtime action", () => {
  it("workspace runtime actions: delete persists and emits workspace change", () => {
    const runtime = createRuntimeFixture();

    let saves = 0;
    runtime.workspacePersistence = {
      ...runtime.workspacePersistence,
      save: () => {
        saves += 1;
        return { warning: null };
      },
    };

    let events = 0;
    runtime.workspaceEvents.onDidChangeWorkspaces(() => {
      events += 1;
    });

    registerWorkspaceRuntimeActions(runtime, {
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
      performSwitch: (targetWorkspaceId) => {
        runtime.workspaceManager.activeWorkspaceId = targetWorkspaceId;
        return true;
      },
    });

    // ensure there are 2 workspaces so delete can proceed
    runtime.workspaceManager = {
      ...runtime.workspaceManager,
      workspaces: {
        ...runtime.workspaceManager.workspaces,
        "2": {
          id: "2",
          name: "2",
          contextState: runtime.contextState,
        },
      },
      workspaceOrder: [...runtime.workspaceManager.workspaceOrder, "2"],
      activeWorkspaceId: "1",
    };

    const handler = runtime.runtimeActionRegistry.get("shell.workspace.delete");
    const executed = handler ? handler() : false;

    expect(executed).toBe(true);
    expect(saves).toBe(1);
    expect(events).toBe(1);
  });

  it("workspace runtime actions: switch by index maps to action id semantics", () => {
    const runtime = createRuntimeFixture();
    runtime.workspaceManager = {
      ...runtime.workspaceManager,
      workspaces: {
        ...runtime.workspaceManager.workspaces,
        "2": {
          id: "2",
          name: "2",
          contextState: runtime.contextState,
        },
      },
      workspaceOrder: ["1", "2"],
      activeWorkspaceId: "1",
    };

    let switchedTo: string | null = null;
    registerWorkspaceRuntimeActions(runtime, {
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
      performSwitch: (targetWorkspaceId: string, _deps: WorkspaceSwitchDeps) => {
        switchedTo = targetWorkspaceId;
        runtime.workspaceManager.activeWorkspaceId = targetWorkspaceId;
        return true;
      },
    });

    const switchTwo = runtime.runtimeActionRegistry.get("shell.workspace.switch.2");
    const executed = switchTwo ? switchTwo() : false;

    expect(executed).toBe(true);
    expect(switchedTo).toBe("2");
  });
});

function createRuntimeFixture(): ShellRuntime {
  const contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-a",
    initialGroupColor: "blue",
  });
  const emitter = createEventEmitter<void>();

  return {
    contextState,
    workspaceManager: createInitialWorkspaceManagerState(contextState),
    workspacePersistence: {
      load: () => ({ state: createInitialWorkspaceManagerState(contextState), warning: null }),
      save: () => ({ warning: null }),
    },
    workspaceEvents: {
      fireDidChangeWorkspaces: () => emitter.fire(undefined),
      onDidChangeWorkspaces: emitter.event,
    },
    runtimeActionRegistry: new Map(),
    partHost: { syncRenderedParts: async () => {}, unmountAll: () => {} } as ShellRuntime["partHost"],
  } as unknown as ShellRuntime;
}
