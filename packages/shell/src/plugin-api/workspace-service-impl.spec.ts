import { describe, expect, it } from "vitest";
import { createEventEmitter } from "@ghost-shell/plugin-system";
import { createInitialWorkspaceManagerState } from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";
import { createInitialShellContextState } from "../context-state.js";
import { createWorkspaceService } from "./workspace-service-impl.js";

describe("workspace service impl", () => {
  it("workspace-service: onDidChangeWorkspaces uses shared runtime emitter", () => {
    const runtime = createRuntimeFixture();
    const serviceA = createWorkspaceService({
      getRuntime: () => runtime,
      getWorkspaceSwitchDeps: () => {
        throw new Error("not used");
      },
    }).service;
    const serviceB = createWorkspaceService({
      getRuntime: () => runtime,
      getWorkspaceSwitchDeps: () => {
        throw new Error("not used");
      },
    }).service;

    let callsA = 0;
    let callsB = 0;
    const disposeA = serviceA.onDidChangeWorkspaces(() => {
      callsA += 1;
    });
    const disposeB = serviceB.onDidChangeWorkspaces(() => {
      callsB += 1;
    });

    runtime.workspaceEvents.fireDidChangeWorkspaces();

    expect(callsA).toBe(1);
    expect(callsB).toBe(1);

    disposeA.dispose();
    disposeB.dispose();
  });
});

function createRuntimeFixture(): ShellRuntime {
  const contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-a",
    initialGroupColor: "blue",
  });
  const workspaceChangeEmitter = createEventEmitter<void>();

  return {
    contextState,
    workspaceManager: createInitialWorkspaceManagerState(contextState),
    workspacePersistence: {
      load: () => ({
        state: createInitialWorkspaceManagerState(contextState),
        warning: null,
      }),
      save: () => ({ warning: null }),
    },
    workspaceEvents: {
      fireDidChangeWorkspaces: () => workspaceChangeEmitter.fire(undefined),
      onDidChangeWorkspaces: workspaceChangeEmitter.event,
    },
  } as unknown as ShellRuntime;
}
