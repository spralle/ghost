import assert from "node:assert/strict";
import test from "node:test";
import { createPartModuleHostRuntime } from "../../../packages/shell/src/part-module-host.js";

function createRoot(parts) {
  const content = [];
  const fallback = [];

  for (const partId of parts) {
    content.push({
      dataset: { partContentFor: partId },
      innerHTML: "",
    });
    fallback.push({
      dataset: { partFallbackFor: partId },
      hidden: false,
    });
  }

  const dockTreeRoot = {
    dataset: {},
    innerHTML: "",
  };

  return {
    querySelector(selector) {
      if (selector === "#dock-tree-root") {
        return dockTreeRoot;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-part-content-for]") {
        return content;
      }
      if (selector === "[data-part-fallback-for]") {
        return fallback;
      }
      return [];
    },
    content,
    dockTreeRoot,
    fallback,
  };
}

function createRuntimeStub(pluginId) {
  return {
    windowId: "window-test",
    registry: {
      getBuiltinModule() {
        return null;
      },
      getSnapshot() {
        return {
          plugins: [
            {
              id: pluginId,
              descriptor: {
                id: pluginId,
                entry: "https://plugins.example/mf-manifest.json",
              },
              contract: {},
            },
          ],
        };
      },
    },
  };
}

function createRuntimeWithMutablePlugin(pluginSnapshot) {
  return {
    windowId: "window-test",
    registry: {
      getBuiltinModule() {
        return null;
      },
      getSnapshot() {
        return {
          plugins: [pluginSnapshot],
        };
      },
    },
  };
}

test("part module host mounts and unmounts plugin part lifecycle", async () => {
  const pluginId = "ghost.test.plugin";
  const part = {
    id: "part.one",
    instanceId: "instance.part.one",
    definitionId: "part.one",
    title: "Part One",
    slot: "main",
    pluginId,
    args: { scope: "alpha" },
  };
  const root = createRoot([part.instanceId]);
  const calls = {
    register: 0,
    load: 0,
    mount: 0,
    unmount: 0,
  };

  const host = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {
        calls.register += 1;
      },
      async loadRemoteModule() {
        calls.load += 1;
        return {
          parts: {
            [part.id]: {
              mount(_target, context) {
                calls.mount += 1;
                assert.equal(context.instanceId, part.instanceId);
                assert.equal(context.definitionId, part.definitionId);
                assert.deepEqual(context.args, part.args);
                assert.equal(context.part.id, part.id);
                return {
                  unmount() {
                    calls.unmount += 1;
                  },
                };
              },
            },
          },
        };
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await host.syncRenderedParts(root, [part]);
  assert.equal(calls.register, 1);
  assert.equal(calls.load, 1);
  assert.equal(calls.mount, 1);
  assert.equal(root.fallback[0].hidden, true);

  await host.syncRenderedParts(root, []);
  assert.equal(calls.unmount, 1);
});

test("part module host shows fallback when module missing or invalid", async () => {
  const pluginId = "ghost.test.plugin";
  const part = {
    id: "part.one",
    instanceId: "instance.part.one",
    definitionId: "part.one",
    title: "Part One",
    slot: "main",
    pluginId,
    args: {},
  };
  const root = createRoot([part.instanceId]);

  const missingModuleHost = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        throw new Error("missing expose");
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await missingModuleHost.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, false);

  const invalidModuleHost = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        return {};
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await invalidModuleHost.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, false);
});

test("part module host keeps duplicate instances independent by instance identity", async () => {
  const pluginId = "ghost.test.plugin";
  const parts = [
    {
      id: "part.one",
      instanceId: "part.one#1",
      definitionId: "part.one",
      title: "Part One A",
      slot: "main",
      pluginId,
      args: { tenant: "alpha" },
    },
    {
      id: "part.one",
      instanceId: "part.one#2",
      definitionId: "part.one",
      title: "Part One B",
      slot: "main",
      pluginId,
      args: { tenant: "beta" },
    },
  ];
  const root = createRoot(parts.map((part) => part.instanceId));
  const mounted = [];
  const unmounted = [];

  const host = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        return {
          parts: {
            "part.one": {
              mount(_target, context) {
                mounted.push({
                  instanceId: context.instanceId,
                  definitionId: context.definitionId,
                  args: context.args,
                });
                return {
                  unmount() {
                    unmounted.push(context.instanceId);
                  },
                };
              },
            },
          },
        };
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await host.syncRenderedParts(root, parts);
  assert.deepEqual(mounted, [
    { instanceId: "part.one#1", definitionId: "part.one", args: { tenant: "alpha" } },
    { instanceId: "part.one#2", definitionId: "part.one", args: { tenant: "beta" } },
  ]);

  await host.syncRenderedParts(root, [parts[1]]);
  assert.deepEqual(unmounted, ["part.one#1"]);

  await host.syncRenderedParts(root, []);
  assert.deepEqual(unmounted, ["part.one#1", "part.one#2"]);
});

test("part module host preserves backward compatibility for legacy part shape", async () => {
  const pluginId = "ghost.test.plugin";
  const legacyPart = {
    id: "part.legacy",
    title: "Legacy Part",
    slot: "main",
    pluginId,
  };
  const root = createRoot([legacyPart.id]);
  const contexts = [];

  const host = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        return {
          parts: {
            "part.legacy": {
              mount(_target, context) {
                contexts.push({
                  instanceId: context.instanceId,
                  definitionId: context.definitionId,
                  args: context.args,
                  partId: context.part.id,
                });
              },
            },
          },
        };
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await host.syncRenderedParts(root, [legacyPart]);
  assert.deepEqual(contexts, [
    {
      instanceId: "part.legacy",
      definitionId: "part.legacy",
      args: {},
      partId: "part.legacy",
    },
  ]);
});

test("part module host mounts after plugin lifecycle transition and clears stale fallback", async () => {
  const pluginId = "ghost.test.plugin";
  const part = {
    id: "part.one",
    instanceId: "instance.part.one",
    definitionId: "part.one",
    title: "Part One",
    slot: "main",
    pluginId,
    args: {},
  };
  const root = createRoot([part.instanceId]);
  const mounts = [];
  let lastTransitionAt = "2026-04-08T00:00:00.000Z";
  let lifecycleState = "registered";
  let hasContract = false;

  const runtime = createRuntimeWithMutablePlugin({
    id: pluginId,
    enabled: true,
    descriptor: {
      id: pluginId,
      entry: "https://plugins.example/mf-manifest.json",
    },
    contract: null,
    failure: null,
    lifecycle: {
      state: "registered",
      lastTransitionAt,
      lastTrigger: null,
    },
  });

  const host = createPartModuleHostRuntime(runtime, {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        return {
          parts: {
            [part.id]: {
              mount(_target, context) {
                mounts.push(context.instanceId);
                return {
                  unmount() {},
                };
              },
            },
          },
        };
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await host.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, false);
  assert.deepEqual(mounts, []);

  root.fallback[0].hidden = false;
  await host.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, false);
  assert.deepEqual(mounts, []);

  lifecycleState = "active";
  hasContract = true;
  lastTransitionAt = "2026-04-08T00:00:01.000Z";
  runtime.registry.getSnapshot = () => ({
    plugins: [
      {
        id: pluginId,
        enabled: true,
        descriptor: {
          id: pluginId,
          entry: "https://plugins.example/mf-manifest.json",
        },
        contract: hasContract ? {} : null,
        failure: null,
        lifecycle: {
          state: lifecycleState,
          lastTransitionAt,
          lastTrigger: {
            type: "view",
            id: "shell.render",
          },
        },
      },
    ],
  });

  await host.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, true);
  assert.deepEqual(mounts, [part.instanceId]);
  assert.equal(root.fallback[0].hidden, true);
});
