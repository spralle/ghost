import { describe, expect, it } from "vitest";
import type { IntentRuntime } from "@ghost-shell/intents";
import type { ActionSurface } from "../action-surface.js";
import { type ActionServiceDependencies, createActionService } from "./action-service.js";

function createTestSurface(): ActionSurface {
  return {
    actions: [
      {
        id: "shell.action.open",
        title: "Open File",
        intent: "shell.intent.open",
        pluginId: "shell.core",
      },
      {
        id: "shell.action.save",
        title: "Save File",
        intent: "shell.intent.save",
        pluginId: "shell.core",
        when: { dirty: true },
      },
      {
        id: "plugin.action.deploy",
        title: "Deploy",
        intent: "plugin.intent.deploy",
        pluginId: "plugin.deploy",
        when: { role: "admin" },
      },
    ],
    menus: [],
    keybindings: [
      {
        action: "shell.action.open",
        keybinding: "ctrl+o",
        pluginId: "shell.core",
      },
      {
        action: "plugin.action.deploy",
        keybinding: "ctrl+shift+d",
        pluginId: "plugin.deploy",
      },
    ],
  };
}

function createMockIntentRuntime(): IntentRuntime {
  return {
    async resolve(_intent, _delegate, _options) {
      return {
        kind: "executed",
        match: {
          pluginId: "shell.core",
          pluginName: "Shell",
          actionId: "stub",
          title: "Stub",
          handler: "stub",
          intentType: "stub",
          when: {},
          loadStrategy: "eager",
          registrationOrder: 0,
          sortKey: "stub",
        },
        trace: { intentType: "", evaluatedAt: 0, actions: [], matched: [] },
      };
    },
  };
}

function createTestDeps(overrides: Partial<ActionServiceDependencies> = {}): ActionServiceDependencies {
  return {
    getActionSurface: () => createTestSurface(),
    getActionContext: () => ({}),
    getIntentRuntime: () => createMockIntentRuntime(),
    activatePlugin: async () => true,
    ...overrides,
  };
}

describe("action service", () => {
  // ─── getActions() ───

  it("action-service: getActions returns descriptors with enabled state", async () => {
    const deps = createTestDeps({
      getActionContext: () => ({ dirty: true, role: "admin" }),
    });
    const { service } = createActionService(deps);

    const actions = await service.getActions();
    expect(actions.length).toBe(3);

    const openAction = actions.find((a) => a.id === "shell.action.open");
    expect(openAction).toBeTruthy();
    expect(openAction?.enabled).toBe(true);
    expect(openAction?.disabledReason).toBe(undefined);

    const saveAction = actions.find((a) => a.id === "shell.action.save");
    expect(saveAction).toBeTruthy();
    expect(saveAction?.enabled).toBe(true);
  });

  it("action-service: getActions marks disabled actions with reason", async () => {
    const deps = createTestDeps({
      getActionContext: () => ({ dirty: false }),
    });
    const { service } = createActionService(deps);

    const actions = await service.getActions();

    const saveAction = actions.find((a) => a.id === "shell.action.save");
    expect(saveAction).toBeTruthy();
    expect(saveAction?.enabled).toBe(false);
    expect(saveAction?.disabledReason).toBe("Action 'Save File' is not available in current context");
  });

  it("action-service: getActions includes keybinding hints", async () => {
    const { service } = createActionService(createTestDeps());

    const actions = await service.getActions();

    const openAction = actions.find((a) => a.id === "shell.action.open");
    expect(openAction?.keybinding).toBe("ctrl+o");

    const deployAction = actions.find((a) => a.id === "plugin.action.deploy");
    expect(deployAction?.keybinding).toBe("ctrl+shift+d");

    const saveAction = actions.find((a) => a.id === "shell.action.save");
    expect(saveAction?.keybinding).toBe(undefined);
  });

  it("action-service: getActions preserves pluginId", async () => {
    const { service } = createActionService(createTestDeps());

    const actions = await service.getActions();

    const openAction = actions.find((a) => a.id === "shell.action.open");
    expect(openAction?.pluginId).toBe("shell.core");

    const deployAction = actions.find((a) => a.id === "plugin.action.deploy");
    expect(deployAction?.pluginId).toBe("plugin.deploy");
  });

  // ─── registerAction() ───

  it("action-service: registerAction fires onDidChangeActions", () => {
    const { service } = createActionService(createTestDeps());

    let fired = 0;
    service.onDidChangeActions(() => {
      fired += 1;
    });

    service.registerAction("custom.action", () => "result");
    expect(fired).toBe(1);
  });

  it("action-service: registerAction disposable removes action and fires event", () => {
    const { service } = createActionService(createTestDeps());

    let fired = 0;
    service.onDidChangeActions(() => {
      fired += 1;
    });

    const disposable = service.registerAction("custom.action", () => "result");
    expect(fired).toBe(1);

    disposable.dispose();
    expect(fired).toBe(2);
  });

  // ─── executeAction() ───

  it("action-service: executeAction calls activation then dispatch", async () => {
    let activatedPluginId = "";
    let activatedTriggerId = "";

    const deps = createTestDeps({
      activatePlugin: async (pluginId, triggerId) => {
        activatedPluginId = pluginId;
        activatedTriggerId = triggerId;
        return true;
      },
    });
    const { service } = createActionService(deps);

    await service.executeAction("shell.action.open");

    expect(activatedPluginId).toBe("shell.core");
    expect(activatedTriggerId).toBe("shell.action.open");
  });

  it("action-service: executeAction throws when action not found", async () => {
    const { service } = createActionService(createTestDeps());

    let threw = false;
    try {
      await service.executeAction("nonexistent.action");
    } catch (error) {
      threw = true;
      expect(error instanceof Error && error.message.includes("nonexistent.action")).toBeTruthy();
    }

    expect(threw).toBe(true);
  });

  it("action-service: executeAction throws when plugin activation fails", async () => {
    const deps = createTestDeps({
      activatePlugin: async () => false,
    });
    const { service } = createActionService(deps);

    let threw = false;
    try {
      await service.executeAction("shell.action.open");
    } catch (error) {
      threw = true;
      expect(error instanceof Error && error.message.includes("blocked")).toBeTruthy();
    }

    expect(threw).toBe(true);
  });

  it("action-service: executeAction executes runtime-registered actions directly", async () => {
    const { service } = createActionService(createTestDeps());

    let handlerCalled = false;
    service.registerAction("runtime.action", () => {
      handlerCalled = true;
      return "runtime-result";
    });

    await service.executeAction("runtime.action");
    expect(handlerCalled).toBe(true);
  });

  it("action-service: executeAction uses shared runtimeActionRegistry handlers", async () => {
    const sharedRuntimeRegistry = new Map<string, (...args: unknown[]) => unknown>();
    let called = false;
    sharedRuntimeRegistry.set("shell.workspace.create", () => {
      called = true;
      return true;
    });

    const { service } = createActionService(
      createTestDeps({
        runtimeActionRegistry: sharedRuntimeRegistry,
      }),
    );

    await service.executeAction("shell.workspace.create");
    expect(called).toBe(true);
  });

  // ─── fireChanged() ───

  it("action-service: fireChanged notifies onDidChangeActions listeners", () => {
    const result = createActionService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeActions(() => {
      fired += 1;
    });

    result.fireChanged();
    expect(fired).toBe(1);

    result.fireChanged();
    expect(fired).toBe(2);
  });

  it("action-service: dispose clears all listeners", () => {
    const result = createActionService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeActions(() => {
      fired += 1;
    });

    result.fireChanged();
    expect(fired).toBe(1);

    result.dispose();
    result.fireChanged();
    expect(fired).toBe(1);
  });
});
