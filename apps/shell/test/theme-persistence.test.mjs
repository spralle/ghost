import assert from "node:assert/strict";
import test from "node:test";
import {
  clearBackgroundPreference,
  readBackgroundPreference,
  readUserThemePreference,
  writeBackgroundPreference,
  writeUserThemePreference,
} from "../../../packages/theme/src/theme-persistence.js";

// ---------------------------------------------------------------------------
// Background persistence — Node environment (no localStorage)
//
// In Node.js, window/localStorage are undefined, so all reads return null
// and all writes silently no-op.  These tests verify graceful degradation.
// ---------------------------------------------------------------------------

test("readBackgroundPreference returns null when no localStorage", () => {
  const result = readBackgroundPreference("any-theme");
  assert.equal(result, null);
});

test("writeBackgroundPreference does not throw in Node environment", () => {
  assert.doesNotThrow(() => writeBackgroundPreference("any-theme", { index: 2 }));
});

test("clearBackgroundPreference does not throw in Node environment", () => {
  assert.doesNotThrow(() => clearBackgroundPreference("any-theme"));
});

test("writeBackgroundPreference with custom entry does not throw", () => {
  assert.doesNotThrow(() =>
    writeBackgroundPreference("custom-theme", {
      index: null,
      custom: { url: "https://example.com/bg.jpg", mode: "cover" },
    }),
  );
});

test("readBackgroundPreference returns null after write in Node (no storage)", () => {
  // Write should no-op, so read should still return null.
  writeBackgroundPreference("test-theme", { index: 1 });
  const result = readBackgroundPreference("test-theme");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Theme preference — ThemePreferenceData format
// ---------------------------------------------------------------------------

test("readUserThemePreference returns null when no localStorage (Node env)", () => {
  const result = readUserThemePreference();
  assert.equal(result, null);
});

test("writeUserThemePreference with ThemePreferenceData does not throw in Node env", () => {
  assert.doesNotThrow(() =>
    writeUserThemePreference({ themeId: "ghost.theme.retro-82", pluginId: "ghost.theme.default" }),
  );
});
