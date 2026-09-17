import assert from "node:assert/strict";
import test from "node:test";
import { createPluginConfigSyncController } from "../../../packages/shell/src/plugin-config-sync-controller.js";

function createRegistry(pluginIds) {
  const states = new Map(pluginIds.map((pluginId) => [pluginId, false]));
  const calls = [];

  return {
    calls,
    registry: {
      async setEnabled(pluginId, enabled) {
        if (!states.has(pluginId)) {
          throw new Error(`Unknown plugin: ${pluginId}`);
        }

        calls.push({ pluginId, enabled });
        states.set(pluginId, enabled);
      },
      getSnapshot() {
        return {
          plugins: Array.from(states.entries()).map(([id, enabled]) => ({ id, enabled })),
        };
      },
    },
  };
}

function createConfigService(initial = {}) {
  const values = new Map(Object.entries(initial));
  const listeners = new Map();

  return {
    values,
    listenerCount: () => Array.from(listeners.values()).reduce((count, entries) => count + entries.size, 0),
    service: {
      get(key) {
        return values.get(key);
      },
      onChange(key, listener) {
        const entries = listeners.get(key) ?? new Set();
        entries.add(listener);
        listeners.set(key, entries);
        return () => {
          const current = listeners.get(key);
          if (!current) {
            return;
          }
          current.delete(listener);
          if (current.size === 0) {
            listeners.delete(key);
          }
        };
      },
      emit(key, value) {
        values.set(key, value);
        for (const listener of listeners.get(key) ?? []) {
          listener(value);
        }
      },
    },
  };
}

function deriveNamespace(pluginId) {
  return pluginId
    .split(".")
    .map((segment) => segment.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()))
    .join(".");
}

test("applySnapshot respects config enable flags", async () => {
  const pluginA = "ghost.domain.unplanned-orders";
  const pluginB = "ghost.domain.vessel-view";
  const { registry, calls } = createRegistry([pluginA, pluginB]);
  const config = createConfigService({
    "ghost.plugins.ghost.domain.unplannedOrders.enabled": false,
    "ghost.plugins.ghost.domain.vesselView": { enabled: true },
  });

  const controller = createPluginConfigSyncController({
    registry,
    configurationService: config.service,
    deriveNamespace,
    pluginIds: [pluginA, pluginB],
    defaultEnabled: true,
  });

  await controller.applySnapshot();

  assert.deepEqual(calls, [
    { pluginId: pluginA, enabled: false },
    { pluginId: pluginB, enabled: true },
  ]);
});

test("missing config falls back to defaultEnabled", async () => {
  const pluginId = "ghost.domain.unplanned-orders";
  const { registry, calls } = createRegistry([pluginId]);
  const config = createConfigService();

  const controller = createPluginConfigSyncController({
    registry,
    configurationService: config.service,
    deriveNamespace,
    pluginIds: [pluginId],
    defaultEnabled: false,
  });

  await controller.applySnapshot();
  assert.deepEqual(calls, [{ pluginId, enabled: false }]);
});

test("runtime onChange toggles plugin states and deduplicates repeats", async () => {
  const pluginId = "ghost.domain.unplanned-orders";
  const { registry, calls } = createRegistry([pluginId]);
  const config = createConfigService({
    "ghost.plugins.ghost.domain.unplannedOrders": { enabled: false },
  });

  const controller = createPluginConfigSyncController({
    registry,
    configurationService: config.service,
    deriveNamespace,
    pluginIds: [pluginId],
    defaultEnabled: false,
  });

  await controller.applySnapshot();
  const dispose = controller.start();

  config.service.emit("ghost.plugins.ghost.domain.unplannedOrders", { enabled: true });
  await new Promise((resolve) => setImmediate(resolve));
  config.service.emit("ghost.plugins.ghost.domain.unplannedOrders", { enabled: true });
  await new Promise((resolve) => setImmediate(resolve));
  config.service.emit("ghost.plugins.ghost.domain.unplannedOrders", { enabled: false });
  await new Promise((resolve) => setImmediate(resolve));

  dispose();

  assert.deepEqual(calls, [
    { pluginId, enabled: false },
    { pluginId, enabled: true },
    { pluginId, enabled: false },
  ]);
});

test("unknown plugin and missing keys are safe", async () => {
  const pluginId = "ghost.domain.unplanned-orders";
  const { registry, calls } = createRegistry([pluginId]);
  const config = createConfigService();

  const controller = createPluginConfigSyncController({
    registry,
    configurationService: config.service,
    deriveNamespace,
    pluginIds: [pluginId, "ghost.unknown.plugin"],
    defaultEnabled: false,
  });

  await controller.applySnapshot();
  const dispose = controller.start();
  config.service.emit("ghost.plugins.ghost.unknown.plugin.enabled", true);
  await new Promise((resolve) => setImmediate(resolve));
  dispose();

  assert.deepEqual(calls, [{ pluginId, enabled: false }]);
});

test("disposer unsubscribes listeners", async () => {
  const pluginId = "ghost.domain.unplanned-orders";
  const { registry } = createRegistry([pluginId]);
  const config = createConfigService();

  const controller = createPluginConfigSyncController({
    registry,
    configurationService: config.service,
    deriveNamespace,
    pluginIds: [pluginId],
    defaultEnabled: false,
  });

  await controller.applySnapshot();
  const dispose = controller.start();
  assert.equal(config.listenerCount(), 2);
  dispose();
  assert.equal(config.listenerCount(), 0);
});
