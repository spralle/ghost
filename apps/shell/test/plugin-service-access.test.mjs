import assert from "node:assert/strict";
import test from "node:test";
import { THEME_SERVICE_ID } from "../../../packages/plugin-contracts/dist/index.js";
import { createShellPluginRegistry } from "../../../packages/shell/src/plugin-registry.js";
import { createPluginServicesBridge } from "../../../packages/shell/src/plugin-service-bridge.js";

// ---------------------------------------------------------------------------
// Helper — register a builtin plugin with a service instance
// ---------------------------------------------------------------------------

function createRegistryWithService(serviceId, serviceInstance) {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  registry.registerBuiltinPlugin(
    {
      manifest: { id: "test.provider", name: "Test Provider", version: "1.0.0" },
      contributes: {
        capabilities: {
          services: [{ id: serviceId, version: "1.0.0" }],
        },
      },
    },
    { [serviceId]: serviceInstance },
  );
  return registry;
}

// ---------------------------------------------------------------------------
// Plugin service access via createPluginServicesBridge
// ---------------------------------------------------------------------------

test("createPluginServicesBridge returns PluginServices-compatible object", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const bridge = createPluginServicesBridge(registry);
  assert.equal(typeof bridge.getService, "function");
  assert.equal(typeof bridge.hasService, "function");
});

test("bridge.getService returns registered builtin service instance", () => {
  const fakeThemeService = {
    listThemes: () => [{ id: "default", name: "Default", mode: "dark" }],
    getActiveThemeId: () => "default",
    setTheme: () => true,
    listBackgrounds: () => [],
    getActiveBackground: () => null,
    setBackground: () => false,
    setCustomBackground: () => {},
    clearCustomBackground: () => {},
  };

  const registry = createRegistryWithService(THEME_SERVICE_ID, fakeThemeService);
  const bridge = createPluginServicesBridge(registry);

  const themeService = bridge.getService(THEME_SERVICE_ID);
  assert.ok(themeService, "getService should return the registered service");
  assert.deepEqual(themeService.listThemes(), [{ id: "default", name: "Default", mode: "dark" }]);
  assert.equal(themeService.getActiveThemeId(), "default");
});

test("bridge.getService returns null when service not registered", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const bridge = createPluginServicesBridge(registry);
  const result = bridge.getService("ghost.nonexistent.Service");
  assert.equal(result, null);
});

test("bridge.hasService reflects registration state", () => {
  const fakeService = { doStuff: () => {} };
  const registry = createRegistryWithService("ghost.test.Service", fakeService);
  const bridge = createPluginServicesBridge(registry);

  assert.equal(bridge.hasService("ghost.test.Service"), true);
  assert.equal(bridge.hasService("ghost.nonexistent"), false);
});

test("bridge preserves service reference identity", () => {
  const fakeService = { counter: 0 };
  const registry = createRegistryWithService("ghost.ref.Service", fakeService);
  const bridge = createPluginServicesBridge(registry);

  const first = bridge.getService("ghost.ref.Service");
  const second = bridge.getService("ghost.ref.Service");
  assert.equal(first, second, "consecutive calls should return same reference");
  assert.equal(first, fakeService, "returned value should be identical to registered object");
});
