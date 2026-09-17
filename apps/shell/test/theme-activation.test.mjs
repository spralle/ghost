import assert from "node:assert/strict";
import test from "node:test";
import {
  activateAllThemePlugins,
  activatePreferredThemePlugin,
  DEFAULT_THEME_PLUGIN_ID,
} from "../../../packages/shell/src/theme-activation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPluginRegistry(plugins) {
  const activatedIds = [];
  return {
    activatedIds,
    getSnapshot() {
      return {
        tenantId: "demo",
        diagnostics: [],
        plugins: plugins.map((p) => ({
          id: p.id,
          enabled: p.enabled ?? true,
          loadStrategy: "remote-manifest",
          descriptor: {
            id: p.id,
            version: "1.0.0",
            entry: "https://example.com/mf-manifest.json",
            compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
            contributes: p.contributes,
          },
          contract: p.contract ?? null,
          failure: null,
          lifecycle: {
            state: p.contract ? "active" : "registered",
            lastTransitionAt: new Date().toISOString(),
            lastTrigger: null,
          },
        })),
      };
    },
    async activateByEvent(pluginId, _eventName) {
      activatedIds.push(pluginId);
      return true;
    },
    // Stubs for interface compliance.
    registerBuiltinPlugin() {},
    registerManifestDescriptors() {},
    async setEnabled() {},
    async activateByCommand() {
      return false;
    },
    async activateByView() {
      return false;
    },
    async activateByIntent() {
      return false;
    },
    async resolveComponentCapability() {
      return null;
    },
    async resolveServiceCapability() {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// DEFAULT_THEME_PLUGIN_ID
// ---------------------------------------------------------------------------

test("DEFAULT_THEME_PLUGIN_ID is ghost.theme.default", () => {
  assert.equal(DEFAULT_THEME_PLUGIN_ID, "ghost.theme.default");
});

// ---------------------------------------------------------------------------
// activatePreferredThemePlugin
// ---------------------------------------------------------------------------

test("activatePreferredThemePlugin activates the preferred plugin", async () => {
  const registry = createMockPluginRegistry([{ id: "ghost.theme.default" }, { id: "ghost.theme.community" }]);

  const result = await activatePreferredThemePlugin(registry, "ghost.theme.community", DEFAULT_THEME_PLUGIN_ID);

  assert.equal(result, true);
  assert.deepEqual(registry.activatedIds, ["ghost.theme.community"]);
});

test("activatePreferredThemePlugin falls back to default when no preference", async () => {
  const registry = createMockPluginRegistry([{ id: "ghost.theme.default" }, { id: "ghost.theme.community" }]);

  const result = await activatePreferredThemePlugin(registry, undefined, DEFAULT_THEME_PLUGIN_ID);

  assert.equal(result, true);
  assert.deepEqual(registry.activatedIds, ["ghost.theme.default"]);
});

test("activatePreferredThemePlugin falls back to default when preferred is empty string", async () => {
  const registry = createMockPluginRegistry([{ id: "ghost.theme.default" }]);

  const result = await activatePreferredThemePlugin(registry, "", DEFAULT_THEME_PLUGIN_ID);

  assert.equal(result, true);
  assert.deepEqual(registry.activatedIds, ["ghost.theme.default"]);
});

test("activatePreferredThemePlugin returns false when plugin not found", async () => {
  const registry = createMockPluginRegistry([{ id: "ghost.theme.default" }]);

  const result = await activatePreferredThemePlugin(registry, "ghost.theme.nonexistent", "also-nonexistent");

  assert.equal(result, false);
  assert.deepEqual(registry.activatedIds, []);
});

test("activatePreferredThemePlugin skips disabled plugins", async () => {
  const registry = createMockPluginRegistry([{ id: "ghost.theme.default", enabled: false }]);

  const result = await activatePreferredThemePlugin(registry, undefined, DEFAULT_THEME_PLUGIN_ID);

  assert.equal(result, false);
  assert.deepEqual(registry.activatedIds, []);
});

// ---------------------------------------------------------------------------
// activateAllThemePlugins
// ---------------------------------------------------------------------------

test("activateAllThemePlugins activates all unloaded enabled plugins", async () => {
  const registry = createMockPluginRegistry([
    {
      id: "ghost.theme.default",
      contract: { manifest: { id: "ghost.theme.default", name: "Default", version: "1.0.0" } },
    },
    { id: "ghost.theme.community", contributes: { themes: [{ id: "community" }] } },
    { id: "ghost.theme.extra", contributes: { themes: [{ id: "extra" }] } },
  ]);

  await activateAllThemePlugins(registry);

  // Only the unloaded plugins should be activated.
  assert.deepEqual(registry.activatedIds, ["ghost.theme.community", "ghost.theme.extra"]);
});

test("activateAllThemePlugins skips disabled plugins", async () => {
  const registry = createMockPluginRegistry([{ id: "ghost.theme.community", enabled: false }]);

  await activateAllThemePlugins(registry);

  assert.deepEqual(registry.activatedIds, []);
});

test("activateAllThemePlugins does nothing when all plugins are already loaded", async () => {
  const contract = { manifest: { id: "ghost.theme.default", name: "Default", version: "1.0.0" } };
  const registry = createMockPluginRegistry([{ id: "ghost.theme.default", contract }]);

  await activateAllThemePlugins(registry);

  assert.deepEqual(registry.activatedIds, []);
});
