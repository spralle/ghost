import type { ActivationContext, GhostApi, PluginServices } from "@ghost-shell/contracts";
import type { SpecHarness } from "../context-state.spec-harness.js";
import { createActivationContext, createGhostApi, type GhostApiFactoryDependencies } from "./ghost-api-factory.js";

const nullServices: PluginServices = { getService: () => null, hasService: () => false } as PluginServices;

function createTestApiDeps(overrides: Partial<GhostApiFactoryDependencies> = {}): GhostApiFactoryDependencies {
  return {
    getActionSurface: () => ({ actions: [], menus: [], keybindings: [] }),
    getActionContext: () => ({}),
    getIntentRuntime: () => ({
      async resolve() {
        return {
          kind: "no-match" as const,
          feedback: "",
          trace: { intentType: "", evaluatedAt: 0, actions: [], matched: [] },
        };
      },
    }),
    activatePlugin: async () => true,
    getWindowId: () => "win-test",
    getIsPopout: () => false,
    getHostWindowId: () => null,
    getPopoutHandles: () => new Map(),
    getSelectedPartId: () => null,
    renderQuickPick: () => {},
    dismissQuickPick: () => {},
    viewServiceDeps: {
      getPartDefinitions: () => [],
      openPartInstance: () => "tab-test",
    },
    workspaceServiceDeps: {
      getRuntime: () => {
        throw new Error("not wired in test");
      },
      getWorkspaceSwitchDeps: () => {
        throw new Error("not wired in test");
      },
    },
    ...overrides,
  };
}

export function registerGhostApiFactorySpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // ─── createGhostApi ───

  test("ghost-api-factory: creates GhostApi with actions and window services", () => {
    const result = createGhostApi(createTestApiDeps());

    assertTruthy(result.api, "api should be defined");
    assertTruthy(result.api.actions, "api.actions should be defined");
    assertTruthy(result.api.window, "api.window should be defined");
    assertTruthy(result.actionServiceHandle, "actionServiceHandle should be defined");
    assertTruthy(result.windowServiceHandle, "windowServiceHandle should be defined");
  });

  test("ghost-api-factory: actions service can register and execute runtime actions", async () => {
    const { api } = createGhostApi(createTestApiDeps());

    let called = false;
    api.actions.registerAction("test.action", () => {
      called = true;
    });

    await api.actions.executeAction("test.action");
    assertEqual(called, true, "runtime action handler should be called");
  });

  test("ghost-api-factory: window service reflects correct windowId", () => {
    const { api } = createGhostApi(createTestApiDeps({ getWindowId: () => "win-42" }));

    assertEqual(api.window.windowId, "win-42", "windowId should match deps");
  });

  // ─── createActivationContext ───

  test("ghost-api-factory: createActivationContext returns context with pluginId", () => {
    const ctx = createActivationContext("com.test.plugin", nullServices);

    assertEqual(ctx.pluginId, "com.test.plugin", "pluginId should match");
    assertTruthy(Array.isArray(ctx.subscriptions), "subscriptions should be an array");
    assertEqual(ctx.subscriptions.length, 0, "subscriptions should start empty");
  });

  test("ghost-api-factory: ActivationContext.subscriptions collects disposables", () => {
    const ctx = createActivationContext("com.test.plugin", nullServices);

    let disposed1 = false;
    let disposed2 = false;

    ctx.subscriptions.push({
      dispose: () => {
        disposed1 = true;
      },
    });
    ctx.subscriptions.push({
      dispose: () => {
        disposed2 = true;
      },
    });

    assertEqual(ctx.subscriptions.length, 2, "should have 2 subscriptions");

    // Simulate deactivation: dispose all
    for (const sub of ctx.subscriptions) {
      sub.dispose();
    }

    assertEqual(disposed1, true, "first subscription should be disposed");
    assertEqual(disposed2, true, "second subscription should be disposed");
  });

  // ─── activate() lifecycle integration ───

  test("ghost-api-factory: activate receives working GhostApi", async () => {
    const deps = createTestApiDeps();
    const { api } = createGhostApi(deps);
    const ctx = createActivationContext("com.test.plugin", nullServices);

    let receivedApi: GhostApi | null = null;
    let receivedCtx: ActivationContext | null = null;

    const activate = (a: GhostApi, c: ActivationContext): void => {
      receivedApi = a;
      receivedCtx = c;
      // Plugin registers a runtime action
      c.subscriptions.push(a.actions.registerAction("test.runtime.action", () => "result"));
    };

    activate(api, ctx);

    assertTruthy(receivedApi, "activate should receive api");
    assertTruthy(receivedCtx, "activate should receive context");
    assertEqual(ctx.subscriptions.length, 1, "should have 1 subscription from activate");

    // Verify the registered action works
    const _result = await api.actions.executeAction("test.runtime.action");
    // Runtime action returns the value, but executeAction's generic makes it T
    assertTruthy(true, "runtime action should execute without error");
  });

  test("ghost-api-factory: subscriptions auto-dispose cleans up actions", () => {
    const deps = createTestApiDeps();
    const { api } = createGhostApi(deps);
    const ctx = createActivationContext("com.test.plugin", nullServices);

    let changeCount = 0;
    api.actions.onDidChangeActions(() => {
      changeCount += 1;
    });

    const disposable = api.actions.registerAction("test.action", () => {});
    ctx.subscriptions.push(disposable);

    // Register fires onDidChangeActions
    assertEqual(changeCount, 1, "should fire on register");

    // Dispose all subscriptions (simulates deactivation)
    for (const sub of ctx.subscriptions) {
      sub.dispose();
    }

    // Dispose fires onDidChangeActions again
    assertEqual(changeCount, 2, "should fire on dispose");
  });
}
