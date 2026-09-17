import assert from "node:assert/strict";
import test from "node:test";
import { createIntentRuntime } from "@ghost-shell/intents";
import { createInitialWorkspaceManagerState } from "@ghost-shell/state";
import { Window } from "happy-dom";
import { buildActionSurface, dispatchAction, resolveMenuActions } from "../../../packages/shell/src/action-surface.ts";
import { bootstrapShellWithTenantManifest } from "../../../packages/shell/src/app/bootstrap.ts";
import { createInitialShellContextState, registerTab } from "../../../packages/shell/src/context-state.ts";
import { moveDockTabThroughRuntime } from "../../../packages/shell/src/ui/dock-tab-dnd.ts";
import { closeTabThroughRuntime } from "../../../packages/shell/src/ui/part-instance-tab-lifecycle.ts";
import { renderDockTree } from "../../../packages/shell/src/ui/parts-rendering.ts";

const browserWindow = new Window();
globalThis.window = browserWindow;
globalThis.document = browserWindow.document;
globalThis.localStorage = browserWindow.localStorage;

const DOMAIN_UNPLANNED = {
  id: "ghost.domain.unplanned-orders",
  version: "0.1.0",
  entry: "http://127.0.0.1:4173/mf-manifest.json",
  compatibility: {
    shell: "^1.0.0",
    pluginContract: "^1.0.0",
  },
};

const DOMAIN_VESSEL = {
  id: "ghost.domain.vessel-view",
  version: "0.1.0",
  entry: "http://127.0.0.1:4174/mf-manifest.json",
  compatibility: {
    shell: "^1.0.0",
    pluginContract: "^1.0.0",
  },
};

function createActionContract() {
  return {
    manifest: { id: "ghost.integration.commands", name: "Integration Commands", version: "0.1.0" },
    contributes: {
      actions: [
        { id: "domain.open-order", title: "Open order", intent: "domain.order.open", when: { hasOrder: true } },
      ],
      menus: [{ menu: "actionPalette", action: "domain.open-order", when: { canOpenOrder: true } }],
      keybindings: [{ action: "domain.open-order", keybinding: "ctrl+shift+o", when: { canOpenOrder: true } }],
    },
  };
}

test("plugin-composed actions follow the enabled contract set", () => {
  const disabledSurface = buildActionSurface([]);
  const enabledSurface = buildActionSurface([createActionContract()]);

  assert.deepEqual(disabledSurface.actions, []);
  assert.deepEqual(
    enabledSurface.actions.map((action) => action.id),
    ["domain.open-order"],
  );
  assert.deepEqual(
    enabledSurface.keybindings.map((binding) => binding.keybinding),
    ["ctrl+shift+o"],
  );
});

test("context-gated action visibility is resolved from runtime facts", () => {
  const surface = buildActionSurface([createActionContract()]);

  assert.deepEqual(resolveMenuActions(surface, "actionPalette", { hasOrder: true, canOpenOrder: false }), []);
  assert.deepEqual(
    resolveMenuActions(surface, "actionPalette", { hasOrder: true, canOpenOrder: true }).map((action) => action.id),
    ["domain.open-order"],
  );
});

test("action dispatch only runs predicate-compatible contributions", async () => {
  const surface = buildActionSurface([createActionContract()]);
  const calls = [];
  const runtime = {
    async resolve(intent) {
      calls.push(intent.type);
      return { kind: "executed", trace: { actions: [], matched: [], evaluatedAt: 0, intentType: intent.type } };
    },
  };

  assert.equal(await dispatchAction(surface, runtime, "domain.open-order", { hasOrder: false }), false);
  assert.equal(await dispatchAction(surface, runtime, "domain.open-order", { hasOrder: true }), true);
  assert.deepEqual(calls, ["domain.order.open"]);
});

test("intent runtime activates the matching plugin through its public delegate", async () => {
  const contract = createActionContract();
  const runtime = createIntentRuntime({
    getRegistrySnapshot: () => ({
      plugins: [{ id: contract.manifest.id, enabled: true, loadStrategy: "local", contract }],
    }),
  });
  const activationCalls = [];
  const outcome = await runtime.resolve(
    { type: "domain.order.open", facts: { hasOrder: true } },
    {
      async showChooser(matches) {
        return matches[0] ?? null;
      },
      async activatePlugin(pluginId, trigger) {
        activationCalls.push({ pluginId, trigger });
        return true;
      },
      announce() {},
    },
  );

  assert.equal(outcome.kind, "executed");
  assert.equal(activationCalls.length, 1);
  assert.equal(activationCalls[0].pluginId, "ghost.integration.commands");
  assert.deepEqual(activationCalls[0].trigger, { type: "intent", id: "domain.order.open" });
});

test("shell bootstrap keeps inner-loop mode for loopback override entries", async () => {
  const manifest = {
    tenantId: "demo",
    plugins: [
      {
        ...DOMAIN_UNPLANNED,
        entry: "http://127.0.0.1:4173/mf-manifest.json",
      },
      {
        ...DOMAIN_VESSEL,
        entry: "http://localhost:4174/mf-manifest.json",
      },
    ],
  };

  const state = await bootstrapShellWithTenantManifest({
    tenantId: "demo",
    fetchManifest: async () => manifest,
  });

  assert.equal(state.mode, "inner-loop");
  const pluginIds = state.registry.getSnapshot().plugins.map((plugin) => plugin.id);
  assert.equal(pluginIds.includes(DOMAIN_UNPLANNED.id), true);
  assert.equal(pluginIds.includes(DOMAIN_VESSEL.id), true);
});

test("shell bootstrap treats local scheme override entries as inner-loop", async () => {
  const manifest = {
    tenantId: "demo",
    plugins: [
      {
        ...DOMAIN_UNPLANNED,
        entry: "local://ghost.domain.unplanned-orders/mf-manifest.json",
      },
      {
        ...DOMAIN_VESSEL,
        entry: "http://localhost:4174/mf-manifest.json",
      },
    ],
  };

  const state = await bootstrapShellWithTenantManifest({
    tenantId: "demo",
    fetchManifest: async () => manifest,
  });

  assert.equal(state.mode, "inner-loop");
});

test("shell bootstrap keeps integration mode when non-loopback plugin entries exist", async () => {
  const manifest = {
    tenantId: "demo",
    plugins: [
      {
        ...DOMAIN_UNPLANNED,
        entry: "http://127.0.0.1:4173/mf-manifest.json",
      },
      {
        ...DOMAIN_VESSEL,
        entry: "https://plugins.ghost.example/mf-manifest.json",
      },
    ],
  };

  const state = await bootstrapShellWithTenantManifest({
    tenantId: "demo",
    fetchManifest: async () => manifest,
  });

  assert.equal(state.mode, "integration");
  const pluginIds = state.registry.getSnapshot().plugins.map((plugin) => plugin.id);
  assert.equal(pluginIds.includes(DOMAIN_UNPLANNED.id), true);
  assert.equal(pluginIds.includes(DOMAIN_VESSEL.id), true);
});

function createCloseRuntimeFixture() {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
    initialGroupColor: "blue",
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

  const runtime = {
    syncDegraded: false,
    windowId: "window-a",
    closeableTabIds: new Set(["tab-a", "tab-b", "tab-c"]),
    contextState,
    workspaceManager: createInitialWorkspaceManagerState(contextState),
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    poppedOutTabIds: new Set(),
    popoutHandles: new Map(),
    registry: {
      getSnapshot() {
        return {
          plugins: [
            {
              id: "ghost.integration.parts",
              enabled: true,
              contract: {
                manifest: {
                  id: "ghost.integration.parts",
                  name: "Integration Parts",
                  version: "0.1.0",
                },
                contributes: {
                  parts: [
                    { id: "tab-a", title: "tab-a", dock: { container: "main" }, component: "a" },
                    { id: "tab-b", title: "Orders", dock: { container: "main" }, component: "b" },
                    { id: "tab-c", title: "Vessels", dock: { container: "main" }, component: "c" },
                  ],
                },
              },
            },
          ],
        };
      },
    },
    contextPersistence: {
      save(nextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    workspacePersistence: {
      save(workspaceManager, nextState) {
        runtime.workspaceManager = workspaceManager;
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    notice: "",
    syncDegradedReason: null,
    pendingProbeId: null,
  };

  const published = [];
  const deps = {
    applySelection(event) {
      runtime.selectedPartId = event.selectedPartId;
      runtime.selectedPartTitle = event.selectedPartTitle;
    },
    publishWithDegrade(event) {
      published.push(event);
    },
    renderContextControls() {},
    renderParts() {},
    renderSyncStatus() {},
  };

  return {
    runtime,
    deps,
    published,
  };
}

test("runtime close flow reconciles active selection and popout handles", () => {
  const fixture = createCloseRuntimeFixture();
  const { runtime, deps, published } = fixture;

  runtime.selectedPartId = "tab-b";
  runtime.selectedPartTitle = "Orders";
  runtime.contextState.activeTabId = "tab-b";
  runtime.poppedOutTabIds.add("tab-b");
  runtime.popoutHandles.set("tab-b", {
    closed: false,
    close() {
      this.closed = true;
    },
  });

  const closed = closeTabThroughRuntime(runtime, "tab-b", deps);
  assert.equal(closed, true);
  assert.equal(runtime.contextState.tabs["tab-b"], undefined);
  assert.equal(runtime.poppedOutTabIds.has("tab-b"), false);
  assert.equal(runtime.popoutHandles.has("tab-b"), false);
  assert.equal(runtime.selectedPartId, "tab-a");

  assert.equal(published[0]?.type, "tab-close");
  assert.equal(published[0]?.tabId, "tab-b");
  assert.equal(published[1]?.type, "selection");
  assert.equal(published[1]?.selectedPartId, "tab-a");
});

test("runtime close flow supports hidden tab close without stealing active tab", () => {
  const fixture = createCloseRuntimeFixture();
  const { runtime, deps, published } = fixture;

  runtime.selectedPartId = "tab-a";
  runtime.selectedPartTitle = "tab-a";
  runtime.contextState.activeTabId = "tab-a";

  const closed = closeTabThroughRuntime(runtime, "tab-c", deps);
  assert.equal(closed, true);
  assert.equal(runtime.contextState.tabs["tab-c"], undefined);
  assert.equal(runtime.selectedPartId, "tab-a");
  assert.equal(runtime.contextState.activeTabId, "tab-a");
  assert.equal(published[0]?.type, "tab-close");
  assert.equal(published[0]?.tabId, "tab-c");
});

test("runtime close flow remains local in degraded mode", () => {
  const fixture = createCloseRuntimeFixture();
  const { runtime, deps, published } = fixture;
  runtime.syncDegraded = true;

  const closed = closeTabThroughRuntime(runtime, "tab-b", deps);
  assert.equal(closed, true);
  assert.equal(runtime.contextState.tabs["tab-b"], undefined);
  assert.equal(runtime.selectedPartId, "tab-a");
  assert.equal(published[0]?.type, "tab-close");
  assert.equal(published[0]?.tabId, "tab-b");
});

function createDockMoveRuntimeFixture() {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
    initialGroupColor: "blue",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-b",
    groupId: "group-main",
    tabLabel: "Orders",
    closePolicy: "closeable",
  });

  const runtime = {
    syncDegraded: false,
    windowId: "window-a",
    contextState,
    workspaceManager: createInitialWorkspaceManagerState(contextState),
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    contextPersistence: {
      save(nextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    workspacePersistence: {
      save(workspaceManager, nextState) {
        runtime.workspaceManager = workspaceManager;
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    notice: "",
  };

  const renders = {
    context: 0,
    parts: 0,
    sync: 0,
  };

  const deps = {
    renderContextControls() {
      renders.context += 1;
    },
    renderParts() {
      renders.parts += 1;
    },
    renderSyncStatus() {
      renders.sync += 1;
    },
  };

  return {
    runtime,
    deps,
    renders,
  };
}

test("dock move/split mutations apply in same-window mode and activate moved tab", () => {
  const fixture = createDockMoveRuntimeFixture();
  const { runtime, deps, renders } = fixture;

  const moved = moveDockTabThroughRuntime(runtime, deps, {
    tabId: "tab-b",
    sourceWindowId: "window-a",
    targetTabId: "tab-a",
    zone: "bottom",
  });

  assert.equal(moved, true);
  assert.equal(runtime.selectedPartId, "tab-b");
  assert.equal(runtime.contextState.activeTabId, "tab-b");
  assert.equal(runtime.contextState.dockTree.root?.kind, "split");
  assert.equal(renders.context, 1);
  assert.equal(renders.parts, 1);
  assert.equal(renders.sync, 1);
});

test("dock move/split mutations remain local in degraded mode", () => {
  const fixture = createDockMoveRuntimeFixture();
  const { runtime, deps, renders } = fixture;
  runtime.syncDegraded = true;

  const beforeDockTree = JSON.stringify(runtime.contextState.dockTree);
  const moved = moveDockTabThroughRuntime(runtime, deps, {
    tabId: "tab-b",
    sourceWindowId: "window-a",
    targetTabId: "tab-a",
    zone: "right",
  });

  assert.equal(moved, true);
  assert.equal(JSON.stringify(runtime.contextState.dockTree) !== beforeDockTree, true);
  assert.equal(runtime.contextState.activeTabId, "tab-b");
  assert.equal(renders.context, 1);
  assert.equal(renders.parts, 1);
  assert.equal(renders.sync, 1);
});

test("recursive dock-tree renderer emits nested stacks with local tab scopes", () => {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  contextState = registerTab(contextState, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders" });
  contextState = registerTab(contextState, { tabId: "tab-c", groupId: "group-main", tabLabel: "Vessels" });
  contextState = registerTab(contextState, { tabId: "tab-d", groupId: "group-main", tabLabel: "Ports" });
  contextState = {
    ...contextState,
    dockTree: {
      root: {
        kind: "split",
        id: "split-1",
        orientation: "horizontal",
        first: {
          kind: "stack",
          id: "stack-left",
          tabIds: ["tab-a", "tab-b"],
          activeTabId: "tab-b",
        },
        second: {
          kind: "split",
          id: "split-2",
          orientation: "vertical",
          first: {
            kind: "stack",
            id: "stack-top-right",
            tabIds: ["tab-c"],
            activeTabId: "tab-c",
          },
          second: {
            kind: "stack",
            id: "stack-bottom-right",
            tabIds: ["tab-d"],
            activeTabId: "tab-d",
          },
        },
      },
    },
  };

  const visibleParts = [
    { id: "tab-a", title: "tab-a", slot: "main", pluginId: "plugin-a" },
    { id: "tab-b", title: "Orders", slot: "main", pluginId: "plugin-a" },
    { id: "tab-c", title: "Vessels", slot: "main", pluginId: "plugin-a" },
    { id: "tab-d", title: "Ports", slot: "main", pluginId: "plugin-a" },
  ];

  const runtime = {
    selectedPartId: "tab-b",
    contextState,
    syncDegraded: false,
    windowId: "window-a",
  };

  const html = renderDockTree(contextState.dockTree.root, visibleParts, runtime);
  assert.match(html, /dock-node-split-horizontal/, "root split should render horizontal class");
  assert.match(html, /dock-node-split-vertical/, "nested split should render vertical class");
  assert.match(html, /data-tab-scope="stack:stack-left"/, "left stack should render local tab scope");
  assert.match(html, /data-tab-scope="stack:stack-top-right"/, "top-right stack should render local tab scope");
  assert.match(html, /data-tab-scope="stack:stack-bottom-right"/, "bottom-right stack should render local tab scope");
});
