import assert from "node:assert/strict";
import test from "node:test";
import { parsePluginContract } from "../../../packages/plugin-contracts/dist/index.js";
import { deriveFullPalette } from "../../../packages/theme/src/index.ts";
import { pluginContract } from "../../../plugins/theme-default-plugin/src/plugin-contract-expose.ts";

// ---------------------------------------------------------------------------
// Contract validation
// ---------------------------------------------------------------------------

test("default theme plugin contract validates against parsePluginContract", () => {
  const result = parsePluginContract(pluginContract);

  assert.equal(result.success, true, "Plugin contract must be valid");
  if (result.success) {
    assert.equal(result.data.manifest.id, "ghost.theme.default");
    assert.equal(result.data.manifest.name, "Ghost Default Themes");
    // Theme plugins no longer declare onStartup — they are activated on demand.
    assert.equal(result.data.activationEvents, undefined);
  }
});

// ---------------------------------------------------------------------------
// All five themes are present
// ---------------------------------------------------------------------------

test("plugin contract contains all five built-in themes", () => {
  const themes = pluginContract.contributes?.themes;

  assert.ok(themes, "contributes.themes must be defined");
  assert.equal(themes.length, 5, "Expected exactly 5 themes");

  const defaultDark = themes.find((t) => t.id === "ghost.theme.default.dark");
  const tokyoNight = themes.find((t) => t.id === "ghost.theme.tokyo-night");
  const retro82 = themes.find((t) => t.id === "ghost.theme.retro-82");
  const floridaMan = themes.find((t) => t.id === "ghost.theme.florida-man");
  const catppuccinLatte = themes.find((t) => t.id === "ghost.theme.catppuccin-latte");

  assert.ok(defaultDark, "Default Dark theme must exist");
  assert.equal(defaultDark.name, "Default Dark");
  assert.equal(defaultDark.mode, "dark");

  assert.ok(tokyoNight, "Tokyo Night theme must exist");
  assert.equal(tokyoNight.name, "Tokyo Night");
  assert.equal(tokyoNight.mode, "dark");

  assert.ok(retro82, "Retro 82 theme must exist");
  assert.equal(retro82.name, "Retro 82");
  assert.equal(retro82.mode, "dark");

  assert.ok(floridaMan, "Florida Man theme must exist");
  assert.equal(floridaMan.name, "Florida Man");
  assert.equal(floridaMan.mode, "dark");

  assert.ok(catppuccinLatte, "Catppuccin Latte theme must exist");
  assert.equal(catppuccinLatte.name, "Catppuccin Latte");
  assert.equal(catppuccinLatte.mode, "light");
});

// ---------------------------------------------------------------------------
// Default Dark palette completeness
// ---------------------------------------------------------------------------

test("Default Dark theme has full explicit palette values", () => {
  const defaultDark = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.default.dark");
  assert.ok(defaultDark);

  const { palette } = defaultDark;
  assert.equal(palette.background, "#14161a");
  assert.equal(palette.foreground, "#e9edf3");
  assert.equal(palette.primary, "#7cb4ff");
  assert.equal(palette.surface, "#121922");
  assert.equal(palette.border, "#334564");
  assert.equal(palette.error, "#8b3030");
  assert.equal(palette.warning, "#f2a65a");
  assert.equal(palette.success, "#22c55e");
  assert.equal(palette.info, "#3b82f6");
});

// ---------------------------------------------------------------------------
// Tokyo Night minimal palette + terminal colors
// ---------------------------------------------------------------------------

test("Tokyo Night theme uses minimal Omarchy-compatible palette", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.tokyo-night");
  assert.ok(tokyoNight);

  const { palette } = tokyoNight;

  // Core colors plus Omarchy opacity values are defined.
  const definedKeys = Object.keys(palette);
  assert.equal(definedKeys.length, 7, "Tokyo Night should have exactly 7 palette values");
  assert.ok(palette.background, "background must be defined");
  assert.ok(palette.foreground, "foreground must be defined");
  assert.ok(palette.accent, "accent must be defined");
  assert.ok(palette.cursor, "cursor must be defined");
  assert.ok(palette.selectionBackground, "selectionBackground must be defined");
  assert.equal(palette.opacity, 0.7);
  assert.equal(palette.opacityActive, 0.85);

  // Has no explicit primary, surface, border, etc.
  assert.equal(palette.primary, undefined, "primary should not be set explicitly");
  assert.equal(palette.surface, undefined, "surface should not be set explicitly");
  assert.equal(palette.border, undefined, "border should not be set explicitly");
});

test("Tokyo Night theme has 16 terminal colors", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.tokyo-night");
  assert.ok(tokyoNight);
  assert.ok(tokyoNight.terminal, "terminal palette must be defined");

  const terminalKeys = Object.keys(tokyoNight.terminal);
  assert.equal(terminalKeys.length, 16, "Expected all 16 ANSI terminal colors");
  assert.equal(tokyoNight.terminal.color0, "#32344a");
  assert.equal(tokyoNight.terminal.color1, "#f7768e");
  assert.equal(tokyoNight.terminal.color15, "#acb0d0");
});

// ---------------------------------------------------------------------------
// Tokyo Night background images
// ---------------------------------------------------------------------------

test("Tokyo Night theme has background images", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.tokyo-night");
  assert.ok(tokyoNight);
  assert.ok(tokyoNight.backgrounds, "Tokyo Night backgrounds must be defined");
  assert.equal(tokyoNight.backgrounds.length, 4, "Expected 4 background images");
  assert.ok(tokyoNight.backgrounds[0].url.includes("swirl-buck"), "First background should contain 'swirl-buck'");
  assert.equal(tokyoNight.backgrounds[0].mode, "cover");
});

// ---------------------------------------------------------------------------
// Retro 82 theme
// ---------------------------------------------------------------------------

test("Retro 82 theme has Omarchy-compatible palette and backgrounds", () => {
  const retro82 = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.retro-82");
  assert.ok(retro82, "Retro 82 theme must exist");
  assert.equal(retro82.name, "Retro 82");
  assert.equal(retro82.mode, "dark");
  assert.ok(retro82.author?.includes("OldJobobo"), "Author must contain OldJobobo");

  // Palette core
  assert.ok(retro82.palette.background, "palette.background must be defined");
  assert.ok(retro82.palette.foreground, "palette.foreground must be defined");
  assert.ok(retro82.palette.accent, "palette.accent must be defined");

  // Terminal has 16 colors
  assert.ok(retro82.terminal, "terminal palette must be defined");
  const terminalKeys = Object.keys(retro82.terminal);
  assert.equal(terminalKeys.length, 16, "Expected 16 terminal colors");

  // Backgrounds
  assert.ok(retro82.backgrounds, "backgrounds must be defined");
  assert.equal(retro82.backgrounds.length, 15, "Expected 15 background images");
});

// ---------------------------------------------------------------------------
// Florida Man theme
// ---------------------------------------------------------------------------

test("Florida Man theme has Omarchy-compatible palette and backgrounds", () => {
  const floridaMan = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.florida-man");
  assert.ok(floridaMan, "Florida Man theme must exist");
  assert.equal(floridaMan.name, "Florida Man");
  assert.equal(floridaMan.mode, "dark");
  assert.ok(floridaMan.author?.includes("OldJobobo"), "Author must contain OldJobobo");

  // Palette core
  assert.ok(floridaMan.palette.background, "palette.background must be defined");
  assert.ok(floridaMan.palette.foreground, "palette.foreground must be defined");
  assert.ok(floridaMan.palette.accent, "palette.accent must be defined");

  // Terminal has 16 colors
  assert.ok(floridaMan.terminal, "terminal palette must be defined");
  const terminalKeys = Object.keys(floridaMan.terminal);
  assert.equal(terminalKeys.length, 16, "Expected 16 terminal colors");

  // Backgrounds
  assert.ok(floridaMan.backgrounds, "backgrounds must be defined");
  assert.equal(floridaMan.backgrounds.length, 11, "Expected 11 background images");
});

// ---------------------------------------------------------------------------
// Catppuccin Latte — first light mode theme
// ---------------------------------------------------------------------------

test("Catppuccin Latte is a light mode theme with proper derivation", () => {
  const catppuccinLatte = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.catppuccin-latte");
  assert.ok(catppuccinLatte, "Catppuccin Latte theme must exist");
  assert.equal(catppuccinLatte.mode, "light");
  assert.ok(catppuccinLatte.author?.includes("Catppuccin"), "Author must contain Catppuccin");
  assert.equal(catppuccinLatte.palette.background, "#eff1f5");

  // Derivation produces light mode
  const derived = deriveFullPalette(catppuccinLatte.palette, catppuccinLatte.terminal);
  assert.equal(derived.mode, "light", "Derived mode must be light");

  // Terminal-derived semantics
  assert.equal(derived.error, "#d20f39", "error should come from terminal color1");
  assert.equal(derived.success, "#40a02b", "success should come from terminal color2");
});

// ---------------------------------------------------------------------------
// Derivation produces a complete palette from Tokyo Night's minimal input
// ---------------------------------------------------------------------------

test("deriveFullPalette fills all gaps for Tokyo Night minimal palette", () => {
  const tokyoNight = pluginContract.contributes?.themes?.find((t) => t.id === "ghost.theme.tokyo-night");
  assert.ok(tokyoNight);

  const derived = deriveFullPalette(tokyoNight.palette, tokyoNight.terminal);

  // Verify all 40 tokens are present
  assert.equal(derived.mode, "dark");
  assert.equal(derived.background, "#1a1b26");
  assert.equal(derived.foreground, "#a9b1d6");
  assert.equal(derived.accent, "#7aa2f7");
  assert.equal(derived.cursor, "#c0caf5");
  assert.equal(derived.selectionBackground, "#7aa2f7");

  // Derived from accent (since no explicit primary)
  assert.equal(derived.primary, "#7aa2f7");

  // Terminal-derived semantics (Omarchy compat)
  assert.equal(derived.error, "#f7768e", "error should come from terminal color1");
  assert.equal(derived.success, "#9ece6a", "success should come from terminal color2");
  assert.equal(derived.warning, "#e0af68", "warning should come from terminal color3");
  assert.equal(derived.info, "#449dab", "info should come from terminal color6");

  // Surface should be derived from background
  assert.ok(derived.surface, "surface must be derived");
  assert.ok(derived.overlay, "overlay must be derived");
  assert.ok(derived.muted, "muted must be derived");
  assert.ok(derived.border, "border must be derived");
  assert.ok(derived.ring, "ring must be derived");

  // All 22 derived tokens should be present
  assert.ok(derived.surfaceForeground, "surfaceForeground must be derived");
  assert.ok(derived.overlayForeground, "overlayForeground must be derived");
  assert.ok(derived.primaryForeground, "primaryForeground must be derived");
  assert.ok(derived.secondaryForeground, "secondaryForeground must be derived");
  assert.ok(derived.accentForeground, "accentForeground must be derived");
  assert.ok(derived.mutedForeground, "mutedForeground must be derived");
  assert.ok(derived.input, "input must be derived");
  assert.ok(derived.selectionForeground, "selectionForeground must be derived");
  assert.ok(derived.hoverBackground, "hoverBackground must be derived");
  assert.ok(derived.activeBackground, "activeBackground must be derived");
  assert.ok(derived.edgeLeft, "edgeLeft must be derived");
  assert.ok(derived.edgeLeftForeground, "edgeLeftForeground must be derived");
  assert.ok(derived.edgeLeftBorder, "edgeLeftBorder must be derived");
  assert.ok(derived.radius, "radius must be derived");
});

// ---------------------------------------------------------------------------
// Author attribution
// ---------------------------------------------------------------------------

test("all themes have author attribution", () => {
  const themes = pluginContract.contributes?.themes;
  assert.ok(themes, "contributes.themes must be defined");

  for (const theme of themes) {
    assert.ok(theme.author, `Theme "${theme.name}" must have an author field`);
  }
});
