import assert from "node:assert/strict";
import test from "node:test";
import { createThemeRegistry, manageBackgroundImage } from "../../../packages/shell/src/theme-registry.js";
import {
  clearUserThemePreference,
  readUserThemePreference,
  writeUserThemePreference,
} from "../../../packages/theme/src/theme-persistence.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContract(themes, activationEvents) {
  return {
    manifest: { id: "mock-plugin", name: "Mock Plugin", version: "1.0.0" },
    contributes: { themes },
    activationEvents,
  };
}

function createMockTheme(id, name, mode) {
  return {
    id,
    name,
    mode: mode ?? "dark",
    palette: {
      background: "#14161a",
      foreground: "#e9edf3",
      primary: "#7cb4ff",
    },
  };
}

function createMockPluginRegistry(plugins) {
  return {
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
    async activateByEvent() {
      return false;
    },
    async resolveComponentCapability() {
      return null;
    },
    async resolveServiceCapability() {
      return null;
    },
    getSnapshot() {
      return {
        tenantId: "demo",
        diagnostics: [],
        plugins: plugins.map((p) => ({
          id: p.pluginId,
          enabled: true,
          loadStrategy: "remote-manifest",
          descriptor: {
            id: p.pluginId,
            version: "1.0.0",
            entry: "https://example.com/mf-manifest.json",
            compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
          },
          contract: p.contract,
          failure: null,
          lifecycle: { state: "active", lastTransitionAt: new Date().toISOString(), lastTrigger: null },
        })),
      };
    },
  };
}

// Mock localStorage for Node.js test environment
function _createMockLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Theme registry: discovery
// ---------------------------------------------------------------------------

test("theme registry discovers themes from active plugin contracts", () => {
  const theme1 = createMockTheme("dark-theme", "Dark Theme", "dark");
  const theme2 = createMockTheme("light-theme", "Light Theme", "light");
  const contract = createMockContract([theme1, theme2]);

  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  const available = themeRegistry.getAvailableThemes();
  assert.equal(available.length, 2);
  assert.equal(available[0].id, "dark-theme");
  assert.equal(available[0].name, "Dark Theme");
  assert.equal(available[0].mode, "dark");
  assert.equal(available[0].pluginId, "ghost.theme.default");
  assert.equal(available[1].id, "light-theme");
  assert.equal(available[1].mode, "light");
});

test("theme registry discovers themes from multiple plugins", () => {
  const theme1 = createMockTheme("plugin-a-theme", "Plugin A Theme");
  const theme2 = createMockTheme("plugin-b-theme", "Plugin B Theme");

  const contractA = createMockContract([theme1]);
  const contractB = createMockContract([theme2]);

  const mockRegistry = createMockPluginRegistry([
    { pluginId: "ghost.plugin-a", contract: contractA },
    { pluginId: "ghost.plugin-b", contract: contractB },
  ]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  const available = themeRegistry.getAvailableThemes();
  assert.equal(available.length, 2);
  assert.equal(available[0].pluginId, "ghost.plugin-a");
  assert.equal(available[1].pluginId, "ghost.plugin-b");
});

// ---------------------------------------------------------------------------
// Theme registry: setTheme
// ---------------------------------------------------------------------------

test("setTheme returns false for unknown theme ID", () => {
  const theme = createMockTheme("known-theme", "Known Theme");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  const result = themeRegistry.setTheme("nonexistent-theme");
  assert.equal(result, false);
  assert.equal(themeRegistry.getActiveThemeId(), null);
});

test("setTheme returns true and updates active theme ID for known theme", () => {
  const theme = createMockTheme("dark-theme", "Dark Theme");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  const result = themeRegistry.setTheme("dark-theme");
  assert.equal(result, true);
  assert.equal(themeRegistry.getActiveThemeId(), "dark-theme");
});

test("setTheme switches between themes", () => {
  const theme1 = createMockTheme("dark-theme", "Dark");
  const theme2 = createMockTheme("light-theme", "Light", "light");
  const contract = createMockContract([theme1, theme2]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.equal(themeRegistry.setTheme("dark-theme"), true);
  assert.equal(themeRegistry.getActiveThemeId(), "dark-theme");

  assert.equal(themeRegistry.setTheme("light-theme"), true);
  assert.equal(themeRegistry.getActiveThemeId(), "light-theme");
});

// ---------------------------------------------------------------------------
// Theme persistence (mock localStorage)
// ---------------------------------------------------------------------------

test("theme persistence reads null when no preference stored", () => {
  // In Node.js, window/localStorage are undefined — readUserThemePreference
  // gracefully returns null.
  const result = readUserThemePreference();
  assert.equal(result, null);
});

test("clearUserThemePreference does not throw in Node environment", () => {
  // Should not throw when localStorage is unavailable.
  assert.doesNotThrow(() => clearUserThemePreference());
});

test("writeUserThemePreference does not throw in Node environment", () => {
  // Should not throw when localStorage is unavailable.
  assert.doesNotThrow(() => writeUserThemePreference({ themeId: "some-theme", pluginId: "p" }));
});

// ---------------------------------------------------------------------------
// Theme resolution: tenant default
// ---------------------------------------------------------------------------

test("applyInitialTheme uses tenant default when no user preference", () => {
  const theme1 = createMockTheme("theme-a", "Theme A");
  const theme2 = createMockTheme("theme-b", "Theme B");
  const contract = createMockContract([theme1, theme2]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({
    pluginRegistry: mockRegistry,
    tenantDefaultThemeId: "theme-b",
  });
  themeRegistry.discoverThemes();
  themeRegistry.applyInitialTheme();

  assert.equal(themeRegistry.getActiveThemeId(), "theme-b");
});

// ---------------------------------------------------------------------------
// Theme resolution: first available
// ---------------------------------------------------------------------------

test("applyInitialTheme uses first available when no preference and no tenant default", () => {
  const theme1 = createMockTheme("first-theme", "First Theme");
  const theme2 = createMockTheme("second-theme", "Second Theme");
  const contract = createMockContract([theme1, theme2]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.applyInitialTheme();

  assert.equal(themeRegistry.getActiveThemeId(), "first-theme");
});

test("applyInitialTheme does nothing when no themes are available", () => {
  const contract = createMockContract([]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.applyInitialTheme();

  assert.equal(themeRegistry.getActiveThemeId(), null);
});

// ---------------------------------------------------------------------------
// Theme resolution: ignores invalid tenant default
// ---------------------------------------------------------------------------

test("applyInitialTheme falls back to first available when tenant default does not match", () => {
  const theme = createMockTheme("actual-theme", "Actual Theme");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({
    pluginRegistry: mockRegistry,
    tenantDefaultThemeId: "nonexistent-default",
  });
  themeRegistry.discoverThemes();
  themeRegistry.applyInitialTheme();

  assert.equal(themeRegistry.getActiveThemeId(), "actual-theme");
});

// ---------------------------------------------------------------------------
// Disabled/inactive plugins are excluded from discovery
// ---------------------------------------------------------------------------

test("theme registry excludes themes from disabled plugins", () => {
  const theme = createMockTheme("hidden-theme", "Hidden");
  const contract = createMockContract([theme]);

  const mockRegistry = {
    ...createMockPluginRegistry([]),
    getSnapshot() {
      return {
        tenantId: "demo",
        diagnostics: [],
        plugins: [
          {
            id: "ghost.disabled",
            enabled: false,
            loadStrategy: "remote-manifest",
            descriptor: {
              id: "ghost.disabled",
              version: "1.0.0",
              entry: "https://example.com/mf-manifest.json",
              compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
            },
            contract,
            failure: null,
            lifecycle: { state: "disabled", lastTransitionAt: new Date().toISOString(), lastTrigger: null },
          },
        ],
      };
    },
  };

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.equal(themeRegistry.getAvailableThemes().length, 0);
});

test("theme registry excludes plugins with null contract", () => {
  const mockRegistry = createMockPluginRegistry([]);
  // Override to return a plugin with null contract
  mockRegistry.getSnapshot = () => ({
    tenantId: "demo",
    diagnostics: [],
    plugins: [
      {
        id: "ghost.no-contract",
        enabled: true,
        loadStrategy: "remote-manifest",
        descriptor: {
          id: "ghost.no-contract",
          version: "1.0.0",
          entry: "https://example.com/mf-manifest.json",
          compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
        },
        contract: null,
        failure: null,
        lifecycle: { state: "registered", lastTransitionAt: new Date().toISOString(), lastTrigger: null },
      },
    ],
  });

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.equal(themeRegistry.getAvailableThemes().length, 0);
});

// ---------------------------------------------------------------------------
// Background image management (manageBackgroundImage)
// ---------------------------------------------------------------------------

// manageBackgroundImage gracefully no-ops when `document` is undefined (Node env).
// We test that it does not throw and that theme contributions with backgrounds
// flow through the registry correctly.

test("manageBackgroundImage does not throw in Node environment (no document)", () => {
  assert.doesNotThrow(() => manageBackgroundImage([{ url: "https://example.com/bg.jpg", mode: "cover" }]));
});

test("manageBackgroundImage does not throw when backgrounds is undefined", () => {
  assert.doesNotThrow(() => manageBackgroundImage(undefined));
});

test("manageBackgroundImage does not throw when backgrounds is empty", () => {
  assert.doesNotThrow(() => manageBackgroundImage([]));
});

test("applyTheme passes backgrounds through to manageBackgroundImage (theme with backgrounds)", () => {
  const theme = {
    ...createMockTheme("bg-theme", "BG Theme"),
    backgrounds: [{ url: "https://example.com/wallpaper.jpg", mode: "cover" }],
  };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.bg", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  // Should not throw — manageBackgroundImage gracefully no-ops in Node
  assert.doesNotThrow(() => {
    const result = themeRegistry.setTheme("bg-theme");
    assert.equal(result, true);
  });
  assert.equal(themeRegistry.getActiveThemeId(), "bg-theme");
});

test("theme switch between themes with and without backgrounds does not throw", () => {
  const themeWithBg = {
    ...createMockTheme("with-bg", "With BG"),
    backgrounds: [{ url: "https://example.com/bg.png", mode: "tile" }],
  };
  const themeWithoutBg = createMockTheme("without-bg", "Without BG");
  const contract = createMockContract([themeWithBg, themeWithoutBg]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.mixed", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.doesNotThrow(() => {
    themeRegistry.setTheme("with-bg");
    themeRegistry.setTheme("without-bg");
    themeRegistry.setTheme("with-bg");
  });
  assert.equal(themeRegistry.getActiveThemeId(), "with-bg");
});

// ---------------------------------------------------------------------------
// Background selection API
// ---------------------------------------------------------------------------

test("getAvailableBackgrounds returns empty array when no theme active", () => {
  const theme = createMockTheme("bg-theme", "BG Theme");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.deepEqual(themeRegistry.getAvailableBackgrounds(), []);
});

test("getAvailableBackgrounds returns theme backgrounds after setTheme", () => {
  const backgrounds = [
    { url: "https://example.com/bg1.jpg", mode: "cover" },
    { url: "https://example.com/bg2.jpg", mode: "tile" },
  ];
  const theme = { ...createMockTheme("bg-theme", "BG Theme"), backgrounds };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  const available = themeRegistry.getAvailableBackgrounds();
  assert.equal(available.length, 2);
  assert.equal(available[0].url, "https://example.com/bg1.jpg");
  assert.equal(available[1].url, "https://example.com/bg2.jpg");
});

test("getAvailableBackgrounds returns empty array when theme has no backgrounds", () => {
  const theme = createMockTheme("no-bg-theme", "No BG Theme");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("no-bg-theme");

  assert.deepEqual(themeRegistry.getAvailableBackgrounds(), []);
});

test("setBackground returns true for valid index and updates active background", () => {
  const backgrounds = [
    { url: "https://example.com/bg1.jpg", mode: "cover" },
    { url: "https://example.com/bg2.jpg", mode: "tile" },
  ];
  const theme = { ...createMockTheme("bg-theme", "BG Theme"), backgrounds };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  const result = themeRegistry.setBackground(1);
  assert.equal(result, true);

  const active = themeRegistry.getActiveBackground();
  assert.notEqual(active, null);
  assert.equal(active.url, "https://example.com/bg2.jpg");
  assert.equal(active.mode, "tile");
  assert.equal(active.source, "theme");
  assert.equal(active.index, 1);
});

test("setBackground returns false for out-of-bounds index", () => {
  const backgrounds = [{ url: "https://example.com/bg.jpg" }];
  const theme = { ...createMockTheme("bg-theme", "BG"), backgrounds };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  assert.equal(themeRegistry.setBackground(5), false);
  assert.equal(themeRegistry.setBackground(-1), false);
});

test("setBackground returns false when no theme is active", () => {
  const contract = createMockContract([createMockTheme("t", "T")]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.equal(themeRegistry.setBackground(0), false);
});

test("setCustomBackground applies custom URL and updates active background", () => {
  const theme = {
    ...createMockTheme("bg-theme", "BG"),
    backgrounds: [{ url: "https://example.com/default.jpg" }],
  };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  themeRegistry.setCustomBackground("https://example.com/custom.jpg", "contain");

  const active = themeRegistry.getActiveBackground();
  assert.notEqual(active, null);
  assert.equal(active.url, "https://example.com/custom.jpg");
  assert.equal(active.mode, "contain");
  assert.equal(active.source, "custom");
  assert.equal(active.index, null);
});

test("setCustomBackground defaults mode to cover", () => {
  const theme = createMockTheme("bg-theme", "BG");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  themeRegistry.setCustomBackground("https://example.com/custom.jpg");

  const active = themeRegistry.getActiveBackground();
  assert.notEqual(active, null);
  assert.equal(active.mode, "cover");
});

test("clearCustomBackground reverts to theme default background", () => {
  const backgrounds = [{ url: "https://example.com/default.jpg", mode: "cover" }];
  const theme = { ...createMockTheme("bg-theme", "BG"), backgrounds };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  themeRegistry.setCustomBackground("https://example.com/custom.jpg");
  themeRegistry.clearCustomBackground();

  const active = themeRegistry.getActiveBackground();
  assert.notEqual(active, null);
  assert.equal(active.url, "https://example.com/default.jpg");
  assert.equal(active.source, "theme");
  assert.equal(active.index, 0);
});

test("clearCustomBackground clears background when theme has no backgrounds", () => {
  const theme = createMockTheme("no-bg", "No BG");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("no-bg");

  themeRegistry.setCustomBackground("https://example.com/custom.jpg");
  themeRegistry.clearCustomBackground();

  assert.equal(themeRegistry.getActiveBackground(), null);
});

test("getActiveBackground returns null when no theme is active", () => {
  const contract = createMockContract([createMockTheme("t", "T")]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  assert.equal(themeRegistry.getActiveBackground(), null);
});

test("getActiveBackground returns correct state after setTheme with backgrounds", () => {
  const backgrounds = [{ url: "https://example.com/bg1.jpg", mode: "cover" }, { url: "https://example.com/bg2.jpg" }];
  const theme = { ...createMockTheme("bg-theme", "BG Theme"), backgrounds };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  themeRegistry.setTheme("bg-theme");

  const active = themeRegistry.getActiveBackground();
  assert.notEqual(active, null);
  assert.equal(active.url, "https://example.com/bg1.jpg");
  assert.equal(active.mode, "cover");
  assert.equal(active.source, "theme");
  assert.equal(active.index, 0);
});

test("getAvailableThemes includes author field from theme contribution", () => {
  const theme = {
    ...createMockTheme("authored-theme", "Authored Theme"),
    author: "Test Author",
  };
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  const available = themeRegistry.getAvailableThemes();
  assert.equal(available[0].author, "Test Author");
});

test("getAvailableThemes has undefined author when not set", () => {
  const theme = createMockTheme("no-author-theme", "No Author");
  const contract = createMockContract([theme]);
  const mockRegistry = createMockPluginRegistry([{ pluginId: "ghost.theme.default", contract }]);

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();

  const available = themeRegistry.getAvailableThemes();
  assert.equal(available[0].author, undefined);
});

// ---------------------------------------------------------------------------
// Additive discovery
// ---------------------------------------------------------------------------

test("discoverThemes merges themes additively across multiple calls", () => {
  const themeA = createMockTheme("theme-a", "Theme A");
  const contractA = createMockContract([themeA]);

  const themeB = createMockTheme("theme-b", "Theme B");
  const contractB = createMockContract([themeB]);

  // Start with only plugin A active.
  let activePlugins = [{ pluginId: "ghost.plugin-a", contract: contractA }];
  const mockRegistry = {
    ...createMockPluginRegistry([]),
    getSnapshot() {
      return createMockPluginRegistry(activePlugins).getSnapshot();
    },
  };

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  assert.equal(themeRegistry.getAvailableThemes().length, 1);
  assert.equal(themeRegistry.getAvailableThemes()[0].id, "theme-a");

  // Now add plugin B and re-discover — should merge, not replace.
  activePlugins = [
    { pluginId: "ghost.plugin-a", contract: contractA },
    { pluginId: "ghost.plugin-b", contract: contractB },
  ];
  themeRegistry.discoverThemes();
  assert.equal(themeRegistry.getAvailableThemes().length, 2);
  assert.equal(themeRegistry.getAvailableThemes()[0].id, "theme-a");
  assert.equal(themeRegistry.getAvailableThemes()[1].id, "theme-b");
});

test("discoverThemes updates existing theme when same ID re-discovered", () => {
  const themeV1 = { ...createMockTheme("shared-id", "Version 1"), author: "v1" };
  const contractV1 = createMockContract([themeV1]);

  const themeV2 = { ...createMockTheme("shared-id", "Version 2"), author: "v2" };
  const contractV2 = createMockContract([themeV2]);

  let activePlugins = [{ pluginId: "ghost.plugin-a", contract: contractV1 }];
  const mockRegistry = {
    ...createMockPluginRegistry([]),
    getSnapshot() {
      return createMockPluginRegistry(activePlugins).getSnapshot();
    },
  };

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  assert.equal(themeRegistry.getAvailableThemes()[0].name, "Version 1");

  // Re-discover with updated theme — same ID should be updated.
  activePlugins = [{ pluginId: "ghost.plugin-a", contract: contractV2 }];
  themeRegistry.discoverThemes();
  assert.equal(themeRegistry.getAvailableThemes().length, 1);
  assert.equal(themeRegistry.getAvailableThemes()[0].name, "Version 2");
});

// ---------------------------------------------------------------------------
// loadAllThemes
// ---------------------------------------------------------------------------

test("loadAllThemes activates unloaded plugins and discovers their themes", async () => {
  const themeA = createMockTheme("theme-a", "Theme A");
  const contractA = createMockContract([themeA]);

  const themeB = createMockTheme("theme-b", "Theme B");
  const contractB = createMockContract([themeB]);

  // Track plugin B's activation state via a mutable flag.
  const state = { pluginBActivated: false };

  const mockRegistry = {
    ...createMockPluginRegistry([]),
    getSnapshot() {
      const plugins = [
        {
          id: "ghost.plugin-a",
          enabled: true,
          loadStrategy: "remote-manifest",
          descriptor: {
            id: "ghost.plugin-a",
            version: "1.0.0",
            entry: "https://example.com/a.json",
            compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
          },
          contract: contractA,
          failure: null,
          lifecycle: { state: "active", lastTransitionAt: new Date().toISOString(), lastTrigger: null },
        },
        {
          id: "ghost.plugin-b",
          enabled: true,
          loadStrategy: "remote-manifest",
          descriptor: {
            id: "ghost.plugin-b",
            version: "1.0.0",
            entry: "https://example.com/b.json",
            compatibility: { shell: "^1.0.0", pluginContract: "^1.0.0" },
            contributes: { themes: [{ id: "theme-b" }] },
          },
          contract: state.pluginBActivated ? contractB : null,
          failure: null,
          lifecycle: {
            state: state.pluginBActivated ? "active" : "registered",
            lastTransitionAt: new Date().toISOString(),
            lastTrigger: null,
          },
        },
      ];
      return { tenantId: "demo", diagnostics: [], plugins };
    },
    async activateByEvent(pluginId, _event) {
      if (pluginId === "ghost.plugin-b") {
        state.pluginBActivated = true;
      }
      return true;
    },
  };

  const themeRegistry = createThemeRegistry({ pluginRegistry: mockRegistry });
  themeRegistry.discoverThemes();
  assert.equal(themeRegistry.getAvailableThemes().length, 1);

  await themeRegistry.loadAllThemes();
  assert.equal(themeRegistry.getAvailableThemes().length, 2);
});
