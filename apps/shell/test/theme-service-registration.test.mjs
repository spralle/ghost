import assert from "node:assert/strict";
import test from "node:test";
import { THEME_SERVICE_ID } from "../../../packages/plugin-contracts/dist/index.js";
import { createShellPluginRegistry } from "../../../packages/shell/src/plugin-registry.js";
import {
  registerThemeServiceCapability,
  THEME_SERVICE_PLUGIN_ID,
} from "../../../packages/shell/src/theme-service-registration.js";

// ---------------------------------------------------------------------------
// Mock ThemeRegistry
// ---------------------------------------------------------------------------

function createMockThemeRegistry() {
  const calls = [];
  return {
    calls,
    registry: {
      discoverThemes() {
        calls.push("discoverThemes");
      },
      async loadAllThemes() {
        calls.push("loadAllThemes");
      },
      getAvailableThemes() {
        calls.push("getAvailableThemes");
        return [{ id: "dark-wave", name: "Dark Wave", mode: "dark", pluginId: "p1" }];
      },
      getActiveThemeId() {
        calls.push("getActiveThemeId");
        return "dark-wave";
      },
      setTheme(themeId) {
        calls.push(`setTheme:${themeId}`);
        return true;
      },
      applyInitialTheme() {
        calls.push("applyInitialTheme");
      },
      getAvailableBackgrounds() {
        calls.push("getAvailableBackgrounds");
        return [{ url: "https://example.com/bg.jpg", mode: "cover" }];
      },
      getActiveBackground() {
        calls.push("getActiveBackground");
        return { url: "https://example.com/bg.jpg", mode: "cover", source: "theme", index: 0 };
      },
      setBackground(index) {
        calls.push(`setBackground:${index}`);
        return true;
      },
      setCustomBackground(url, mode) {
        calls.push(`setCustomBackground:${url}:${mode ?? "default"}`);
      },
      clearCustomBackground() {
        calls.push("clearCustomBackground");
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

test("registerThemeServiceCapability registers a builtin plugin", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const snapshot = registry.getSnapshot();
  const themePlugin = snapshot.plugins.find((p) => p.id === THEME_SERVICE_PLUGIN_ID);
  assert.ok(themePlugin, "theme service plugin should appear in snapshot");
  assert.equal(themePlugin.enabled, true);
  assert.equal(themePlugin.lifecycle.state, "active");
});

test("registry.getService returns the ThemeService by ID", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  assert.ok(svc, "getService should return the ThemeService");
});

test("registry.hasService returns true for registered theme service", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  assert.equal(registry.hasService(THEME_SERVICE_ID), true);
});

test("resolveServiceCapability returns the ThemeService", async () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = await registry.resolveServiceCapability("any-plugin", THEME_SERVICE_ID);
  assert.ok(svc, "resolveServiceCapability should return the ThemeService");
});

// ---------------------------------------------------------------------------
// Delegation — listThemes
// ---------------------------------------------------------------------------

test("ThemeService.listThemes delegates to ThemeRegistry.getAvailableThemes", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  const themes = svc.listThemes();
  assert.ok(calls.includes("getAvailableThemes"));
  assert.equal(themes.length, 1);
  assert.equal(themes[0].id, "dark-wave");
});

// ---------------------------------------------------------------------------
// Delegation — getActiveThemeId
// ---------------------------------------------------------------------------

test("ThemeService.getActiveThemeId delegates to ThemeRegistry.getActiveThemeId", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  const id = svc.getActiveThemeId();
  assert.ok(calls.includes("getActiveThemeId"));
  assert.equal(id, "dark-wave");
});

// ---------------------------------------------------------------------------
// Delegation — setTheme
// ---------------------------------------------------------------------------

test("ThemeService.setTheme delegates to ThemeRegistry.setTheme", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  const result = svc.setTheme("ocean-breeze");
  assert.ok(calls.includes("setTheme:ocean-breeze"));
  assert.equal(result, true);
});

// ---------------------------------------------------------------------------
// Delegation — listBackgrounds
// ---------------------------------------------------------------------------

test("ThemeService.listBackgrounds delegates to ThemeRegistry.getAvailableBackgrounds", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  const bgs = svc.listBackgrounds();
  assert.ok(calls.includes("getAvailableBackgrounds"));
  assert.equal(bgs.length, 1);
  assert.equal(bgs[0].url, "https://example.com/bg.jpg");
});

// ---------------------------------------------------------------------------
// Delegation — getActiveBackground
// ---------------------------------------------------------------------------

test("ThemeService.getActiveBackground delegates to ThemeRegistry.getActiveBackground", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  const bg = svc.getActiveBackground();
  assert.ok(calls.includes("getActiveBackground"));
  assert.equal(bg.url, "https://example.com/bg.jpg");
  assert.equal(bg.source, "theme");
  assert.equal(bg.index, 0);
});

// ---------------------------------------------------------------------------
// Delegation — setBackground
// ---------------------------------------------------------------------------

test("ThemeService.setBackground delegates to ThemeRegistry.setBackground", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  const result = svc.setBackground(2);
  assert.ok(calls.includes("setBackground:2"));
  assert.equal(result, true);
});

// ---------------------------------------------------------------------------
// Delegation — setCustomBackground
// ---------------------------------------------------------------------------

test("ThemeService.setCustomBackground delegates to ThemeRegistry.setCustomBackground", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  svc.setCustomBackground("https://example.com/custom.png", "tile");
  assert.ok(calls.includes("setCustomBackground:https://example.com/custom.png:tile"));
});

// ---------------------------------------------------------------------------
// Delegation — clearCustomBackground
// ---------------------------------------------------------------------------

test("ThemeService.clearCustomBackground delegates to ThemeRegistry.clearCustomBackground", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  svc.clearCustomBackground();
  assert.ok(calls.includes("clearCustomBackground"));
});

// ---------------------------------------------------------------------------
// Delegation — loadAllThemes
// ---------------------------------------------------------------------------

test("ThemeService.loadAllThemes delegates to ThemeRegistry.loadAllThemes", async () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry, calls } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);
  const svc = registry.getService(THEME_SERVICE_ID);
  await svc.loadAllThemes();
  assert.ok(calls.includes("loadAllThemes"));
});

// ---------------------------------------------------------------------------
// Persistence across registerManifestDescriptors clear
// ---------------------------------------------------------------------------

test("ThemeService survives registerManifestDescriptors clear", () => {
  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors("local", []);
  const { registry: themeRegistry } = createMockThemeRegistry();
  registerThemeServiceCapability(registry, themeRegistry);

  // Simulate tenant hydration
  registry.registerManifestDescriptors("demo-tenant", []);

  const svc = registry.getService(THEME_SERVICE_ID);
  assert.ok(svc, "ThemeService should survive registerManifestDescriptors clear");
  assert.equal(registry.hasService(THEME_SERVICE_ID), true);
});
