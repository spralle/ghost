import assert from "node:assert/strict";
import test from "node:test";

import { discoverLocalUiPlugins, discoverPluginDefinitions } from "../src/local-ui-plugin-discovery.js";
import {
  DEFAULT_GATEWAY_PLUGIN_ENTRIES,
  DEFAULT_GATEWAY_PORT,
  DEFAULT_LOCAL_PLUGIN_ENTRIES,
  LOCAL_PLUGIN_IDS,
  SORTED_LOCAL_PLUGIN_IDS,
} from "./fixtures/local-plugin-overrides-fixtures.mjs";

test("discoverLocalUiPlugins returns deterministic plugin ordering", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "plugins",
  });

  assert.deepEqual(Array.from(discovered.keys()), SORTED_LOCAL_PLUGIN_IDS);

  const pluginStarter = discovered.get(LOCAL_PLUGIN_IDS.pluginStarter);
  assert.ok(pluginStarter);
  assert.equal(pluginStarter.folderPath, "plugins/plugin-starter");
  assert.equal(pluginStarter.entry, DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.pluginStarter]);

  const sharedUiCapabilities = discovered.get(LOCAL_PLUGIN_IDS.sharedUiCapabilities);
  assert.ok(sharedUiCapabilities);
  assert.equal(sharedUiCapabilities.folderPath, "plugins/shared-ui-capability-plugin");
  assert.equal(sharedUiCapabilities.entry, DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.sharedUiCapabilities]);
});

test("discoverLocalUiPlugins rejects duplicate plugin ids with actionable error", () => {
  const discovered = discoverPluginDefinitions("plugins");
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "plugins",
        definitions: [
          ...discovered,
          {
            id: LOCAL_PLUGIN_IDS.pluginStarter,
            folderName: "plugin-starter-copy",
            devPort: 4271,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
        ],
      }),
    /Duplicate local plugin id 'ghost\.plugin-starter' detected for folders 'plugin-starter' and 'plugin-starter-copy'/,
  );
});

test("discoverLocalUiPlugins normalizes surrounding whitespace in plugin IDs", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "plugins",
    definitions: [
      {
        id: `  ${LOCAL_PLUGIN_IDS.pluginStarter}  `,
        folderName: "plugin-starter",
        devPort: 4171,
        version: "0.1.0",
        entryPath: "/mf-manifest.json",
      },
    ],
  });

  assert.deepEqual(Array.from(discovered.keys()), [LOCAL_PLUGIN_IDS.pluginStarter]);
  const normalized = discovered.get(LOCAL_PLUGIN_IDS.pluginStarter);
  assert.ok(normalized);
  assert.equal(normalized.id, LOCAL_PLUGIN_IDS.pluginStarter);
});

test("discoverLocalUiPlugins rejects duplicate plugin ids that differ only by surrounding whitespace", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "plugins",
        definitions: [
          {
            id: LOCAL_PLUGIN_IDS.pluginStarter,
            folderName: "plugin-starter",
            devPort: 4171,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
          {
            id: ` ${LOCAL_PLUGIN_IDS.pluginStarter} `,
            folderName: "plugin-starter-copy",
            devPort: 4271,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
        ],
      }),
    /Duplicate local plugin id 'ghost\.plugin-starter' detected for folders 'plugin-starter' and 'plugin-starter-copy'/,
  );
});

test("discoverLocalUiPlugins supports deterministic host and protocol mapping", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "plugins",
    host: "localhost",
    protocol: "https",
  });

  assert.equal(
    discovered.get(LOCAL_PLUGIN_IDS.sampleContractConsumer)?.entry,
    "https://localhost:4189/mf-manifest.json",
  );
  assert.deepEqual(Array.from(discovered.keys()), SORTED_LOCAL_PLUGIN_IDS);
});

test("discoverLocalUiPlugins rejects invalid plugin IDs clearly", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "plugins",
        definitions: [
          {
            id: "Ghost.Invalid",
            folderName: "broken-plugin",
            devPort: 4301,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
        ],
      }),
    /Invalid local plugin id 'Ghost\.Invalid' for folder 'broken-plugin'/,
  );
});

test("discoverLocalUiPlugins rejects invalid entries clearly", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "plugins",
        definitions: [
          {
            id: "ghost.invalid-entry",
            folderName: "broken-plugin",
            devPort: 4302,
            version: "0.1.0",
            entryPath: "/wrong-path.json",
          },
        ],
      }),
    /path must end with '\/mf-manifest\.json'/,
  );
});

test("discoverLocalUiPlugins generates gateway-mode URLs when gatewayPort is set", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "plugins",
    gatewayPort: DEFAULT_GATEWAY_PORT,
  });

  assert.deepEqual(Array.from(discovered.keys()), SORTED_LOCAL_PLUGIN_IDS);

  for (const [pluginId, plugin] of discovered) {
    assert.equal(plugin.entry, DEFAULT_GATEWAY_PLUGIN_ENTRIES[pluginId], `gateway entry mismatch for ${pluginId}`);
  }
});

test("discoverLocalUiPlugins without gatewayPort returns legacy per-port URLs", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "plugins",
  });

  for (const [pluginId, plugin] of discovered) {
    assert.equal(plugin.entry, DEFAULT_LOCAL_PLUGIN_ENTRIES[pluginId], `legacy entry mismatch for ${pluginId}`);
  }
});

test("discoverLocalUiPlugins gateway-mode URLs use custom host and protocol", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "plugins",
    host: "localhost",
    protocol: "https",
    gatewayPort: 9999,
  });

  assert.equal(
    discovered.get(LOCAL_PLUGIN_IDS.themeDefault)?.entry,
    "https://localhost:9999/ghost.theme.default/mf-manifest.json",
  );
});

test("assertValidLocalPluginEntryUrl accepts both root and prefixed mf-manifest paths", () => {
  // Both should work without throwing
  discoverLocalUiPlugins({
    appsRoot: "plugins",
    definitions: [
      {
        id: "ghost.test-plugin",
        folderName: "test-plugin",
        devPort: 4999,
        version: "0.1.0",
        entryPath: "/mf-manifest.json",
      },
    ],
  });

  discoverLocalUiPlugins({
    appsRoot: "plugins",
    gatewayPort: DEFAULT_GATEWAY_PORT,
    definitions: [
      {
        id: "ghost.test-plugin",
        folderName: "test-plugin",
        devPort: 4999,
        version: "0.1.0",
        entryPath: "/mf-manifest.json",
      },
    ],
  });
});
