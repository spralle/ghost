import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createConfigurationLifecycleHooks, createInMemorySchemaRegistry, extractPluginSchemas } from "../src/index.ts";

const configurablePlugin = {
  pluginId: "@ghost-shell/theme-service",
  configuration: {
    type: "object",
    properties: {
      activeThemeId: { type: "string", default: "ghost-dark" },
      autoDetect: { type: "boolean", default: true },
    },
  },
};

function createStateContainer(initialLayers = {}) {
  const layers = new Map(Object.entries(initialLayers).map(([layer, entries]) => [layer, { ...entries }]));
  return {
    applyLayerData(layer, entries) {
      layers.set(layer, { ...entries });
    },
    getLayerEntries(layer) {
      return { ...(layers.get(layer) ?? {}) };
    },
  };
}

describe("plugin-config-lifecycle-hooks", () => {
  it("install registers schema and seeds defaults into active layer", () => {
    const stateContainer = createStateContainer({ module: { unrelated: "kept" } });
    const hooks = createConfigurationLifecycleHooks({ stateContainer });

    const result = hooks.install(configurablePlugin);

    assert.deepEqual(result.changedKeys, [
      "ghostShell.themeService.activeThemeId",
      "ghostShell.themeService.autoDetect",
    ]);
    assert.deepEqual(result.schemaErrors, []);
    assert.equal(hooks.getSchemaComposition().schemas.size, 2);
    assert.deepEqual(stateContainer.getLayerEntries("module"), {
      unrelated: "kept",
      "ghostShell.themeService.activeThemeId": "ghost-dark",
      "ghostShell.themeService.autoDetect": true,
    });
  });

  it("disable removes schema + plugin keys; enable re-registers + re-seeds", () => {
    const stateContainer = createStateContainer();
    const hooks = createConfigurationLifecycleHooks({ stateContainer });
    hooks.install(configurablePlugin);

    const disabled = hooks.disable(configurablePlugin.pluginId);

    assert.deepEqual(disabled.changedKeys.sort(), [
      "ghostShell.themeService.activeThemeId",
      "ghostShell.themeService.autoDetect",
    ]);
    assert.equal(hooks.getSchemaComposition().schemas.size, 0);
    assert.deepEqual(hooks.getPluginState(configurablePlugin.pluginId), { installed: true, enabled: false });

    const enabled = hooks.enable(configurablePlugin.pluginId);
    assert.equal(enabled.changedKeys.length, 2);
    assert.equal(hooks.getSchemaComposition().schemas.size, 2);
    assert.deepEqual(hooks.getPluginState(configurablePlugin.pluginId), { installed: true, enabled: true });
  });

  it("uninstall removes plugin state, schema, and config keys", () => {
    const stateContainer = createStateContainer();
    const hooks = createConfigurationLifecycleHooks({ stateContainer });
    hooks.install(configurablePlugin);

    const result = hooks.uninstall(configurablePlugin.pluginId);

    assert.equal(result.changedKeys.length, 2);
    assert.equal(hooks.getSchemaComposition().schemas.size, 0);
    assert.deepEqual(hooks.getPluginState(configurablePlugin.pluginId), { installed: false, enabled: false });
    assert.deepEqual(stateContainer.getLayerEntries("module"), {});
  });

  it("promote copies plugin namespace keys between layers", () => {
    const stateContainer = createStateContainer({
      user: {
        unrelated: "ignored",
        "ghostShell.themeService.activeThemeId": "ghost-light",
      },
      tenant: { existing: "kept" },
    });
    const hooks = createConfigurationLifecycleHooks({ stateContainer });
    hooks.install(configurablePlugin);

    const result = hooks.promote({ pluginId: configurablePlugin.pluginId, fromLayer: "user", toLayer: "tenant" });

    assert.deepEqual(result.changedKeys, ["ghostShell.themeService.activeThemeId"]);
    assert.deepEqual(stateContainer.getLayerEntries("tenant"), {
      existing: "kept",
      "ghostShell.themeService.activeThemeId": "ghost-light",
    });
  });

  it("schema collisions are surfaced and state remains unchanged", () => {
    const collidingPlugin = { ...configurablePlugin, pluginId: "ghost-shell.theme-service" };
    const schemaRegistry = createInMemorySchemaRegistry(extractPluginSchemas([configurablePlugin]));
    const stateContainer = createStateContainer();
    const hooks = createConfigurationLifecycleHooks({ stateContainer, schemaRegistry });

    const result = hooks.install(collidingPlugin);

    assert.equal(result.schemaErrors[0]?.type, "duplicate-key");
    assert.deepEqual(result.changedKeys, []);
    assert.deepEqual(hooks.getPluginState(collidingPlugin.pluginId), { installed: false, enabled: false });
    assert.deepEqual(stateContainer.getLayerEntries("module"), {});
    assert.deepEqual(
      [...hooks.getSchemaComposition().schemas.values()].map((entry) => entry.ownerId),
      [configurablePlugin.pluginId, configurablePlugin.pluginId],
    );
  });
});
