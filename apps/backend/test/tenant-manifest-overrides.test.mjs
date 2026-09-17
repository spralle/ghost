import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLocalPluginEntryOverrides,
  createDefaultLocalPluginEntryUrlMap,
  getTenantManifestResponse,
} from "../src/tenant-manifest.js";
import {
  buildEntryOverrideMap,
  DEFAULT_LOCAL_PLUGIN_ENTRIES,
  LOCAL_PLUGIN_IDS,
  SORTED_LOCAL_PLUGIN_IDS,
} from "./fixtures/local-plugin-overrides-fixtures.mjs";

test("getTenantManifestResponse without selected local plugins matches baseline", () => {
  const baseline = getTenantManifestResponse("demo");

  const withUndefinedSelection = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: undefined,
  });
  const withEmptySelection = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: [],
  });

  assert.deepEqual(withUndefinedSelection, baseline);
  assert.deepEqual(withEmptySelection, baseline);
});

test("selected local plugin receives entry override from default map", () => {
  const selectedPluginId = LOCAL_PLUGIN_IDS.pluginStarter;
  const selectedPluginOverrideEntry = "https://127.0.0.1:5173/mf-manifest.json";

  const manifest = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: [selectedPluginId],
    pluginEntryUrlOverridesById: new Map([[selectedPluginId, selectedPluginOverrideEntry]]),
  });

  const selectedPlugin = manifest.plugins.find((plugin) => plugin.id === selectedPluginId);
  assert.ok(selectedPlugin);
  assert.equal(selectedPlugin.entry, selectedPluginOverrideEntry);
});

test("non-selected local plugins remain unchanged when overrides are applied", () => {
  const selectedPluginId = LOCAL_PLUGIN_IDS.pluginStarter;
  const baseline = getTenantManifestResponse("demo");
  const baselineById = new Map(baseline.plugins.map((plugin) => [plugin.id, plugin.entry]));

  const manifest = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: [selectedPluginId],
    pluginEntryUrlOverridesById: new Map([[selectedPluginId, "https://127.0.0.1:5173/mf-manifest.json"]]),
  });

  for (const plugin of manifest.plugins) {
    if (plugin.id === selectedPluginId) {
      continue;
    }

    assert.equal(plugin.entry, baselineById.get(plugin.id));
  }
});

test("override application is deterministic and idempotent", () => {
  const overrides = buildEntryOverrideMap({
    [LOCAL_PLUGIN_IDS.pluginStarter]: "https://127.0.0.1:5173/mf-manifest.json",
    [LOCAL_PLUGIN_IDS.sampleContractConsumer]: "https://127.0.0.1:5174/mf-manifest.json",
  });
  const selectedPluginIds = [
    LOCAL_PLUGIN_IDS.sampleContractConsumer,
    LOCAL_PLUGIN_IDS.pluginStarter,
    LOCAL_PLUGIN_IDS.pluginStarter,
  ];

  const first = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: selectedPluginIds,
    pluginEntryUrlOverridesById: overrides,
  });

  const second = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: selectedPluginIds,
    pluginEntryUrlOverridesById: overrides,
  });

  assert.deepEqual(second, first);

  const reApplied = applyLocalPluginEntryOverrides(first.plugins, {
    selectedLocalPluginIds: selectedPluginIds,
    pluginEntryUrlOverridesById: overrides,
  });

  assert.deepEqual(reApplied, first.plugins);
});

test("applyLocalPluginEntryOverrides fails fast when selected plugin has no mapped entry", () => {
  const baseline = getTenantManifestResponse("demo");

  assert.throws(
    () =>
      applyLocalPluginEntryOverrides(baseline.plugins, {
        selectedLocalPluginIds: ["ghost.plugin-starter"],
        pluginEntryUrlOverridesById: new Map(),
      }),
    /Missing local plugin override entry mapping for selected plugin id\(s\): ghost\.plugin-starter\./,
  );
});

test("getTenantManifestResponse applies default map for CLI-selected local plugins", () => {
  const selectedPluginIds = [LOCAL_PLUGIN_IDS.sharedUiCapabilities];

  const manifest = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: selectedPluginIds,
  });

  const selectedPlugin = manifest.plugins.find((plugin) => plugin.id === LOCAL_PLUGIN_IDS.sharedUiCapabilities);

  assert.ok(selectedPlugin);
  assert.equal(selectedPlugin.entry, DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.sharedUiCapabilities]);
});

test("getTenantManifestResponse keeps no-override baseline when selection has only blanks", () => {
  const baseline = getTenantManifestResponse("demo");
  const manifest = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: ["   ", ""],
  });

  assert.deepEqual(manifest, baseline);
});

test("applyLocalPluginEntryOverrides fails fast when selected plugin is not in manifest", () => {
  const baseline = getTenantManifestResponse("demo");

  assert.throws(
    () =>
      applyLocalPluginEntryOverrides(baseline.plugins, {
        selectedLocalPluginIds: ["ghost.unknown.plugin"],
        pluginEntryUrlOverridesById: new Map([["ghost.unknown.plugin", "http://127.0.0.1:4999/mf-manifest.json"]]),
      }),
    /Selected local plugin id\(s\) not present in tenant manifest: ghost\.unknown\.plugin\./,
  );
});

test("default override URL map is derived from discovery utility", () => {
  const defaultMap = createDefaultLocalPluginEntryUrlMap({
    appsRoot: "plugins",
  });

  assert.deepEqual(Array.from(defaultMap.keys()), SORTED_LOCAL_PLUGIN_IDS);
  assert.equal(
    defaultMap.get(LOCAL_PLUGIN_IDS.pluginStarter),
    DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.pluginStarter],
  );
});
