import { describe, expect, it } from "vitest";
import { createKeybindingOverrideManager } from "@ghost-shell/commands";
import type { KeybindingOverrideEntryV1, ShellKeybindingPersistence } from "@ghost-shell/persistence";
import type { ActionKeybinding } from "../action-surface.js";
function createMockPersistence(): ShellKeybindingPersistence & { saved: KeybindingOverrideEntryV1[][] } {
  const saved: KeybindingOverrideEntryV1[][] = [];
  let current: KeybindingOverrideEntryV1[] = [];
  return {
    saved,
    load: () => [...current],
    save: (overrides) => {
      current = [...overrides];
      saved.push([...overrides]);
      return { warning: null };
    },
  };
}

const DEFAULT_BINDINGS: ActionKeybinding[] = [
  { action: "shell.focus.left", keybinding: "ctrl+h", pluginId: "com.ghost.shell.defaults" },
  { action: "shell.focus.right", keybinding: "ctrl+l", pluginId: "com.ghost.shell.defaults" },
];

const PLUGIN_BINDINGS: ActionKeybinding[] = [
  { action: "plugin.action.search", keybinding: "ctrl+shift+f", pluginId: "com.ghost.plugin.search" },
  { action: "plugin.action.terminal", keybinding: "ctrl+`", pluginId: "com.ghost.plugin.terminal" },
];

describe("keybinding override manager", () => {
  it("addOverride with no conflicts succeeds", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("shell.focus.left", "ctrl+j");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(0);
    expect(result.warning).toBe(null);
    expect(persistence.saved.length).toBe(1);
  });

  it("addOverride that conflicts with a default binding returns conflict info", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("custom.action", "ctrl+h");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].action).toBe("shell.focus.left");
    expect(result.conflicts[0].layer).toBe("defaults");
    expect(result.conflicts[0].pluginId).toBe("com.ghost.shell.defaults");
    expect(result.conflicts[0].conflictType).toBe("exact");
  });

  it("addOverride that conflicts with a plugin binding returns conflict info", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("custom.action", "ctrl+shift+f");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].action).toBe("plugin.action.search");
    expect(result.conflicts[0].layer).toBe("plugins");
    expect(result.conflicts[0].pluginId).toBe("com.ghost.plugin.search");
    expect(result.conflicts[0].conflictType).toBe("exact");
  });

  it("addOverride that conflicts with an existing user override returns conflict info", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("first.action", "ctrl+k");
    const result = manager.addOverride("second.action", "ctrl+k");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].action).toBe("first.action");
    expect(result.conflicts[0].layer).toBe("user-overrides");
  });

  it("removeOverride for existing override succeeds", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("shell.focus.left", "ctrl+j");
    expect(manager.getOverrides().length).toBe(1);

    const result = manager.removeOverride("shell.focus.left");
    expect(result.success).toBe(true);
    expect(manager.getOverrides().length).toBe(0);
    expect(persistence.saved.length).toBe(2);
  });

  it("removeOverride for non-existent override is a no-op success", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.removeOverride("nonexistent.action");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(0);
    expect(persistence.saved.length).toBe(0);
  });

  it("resetToDefaults clears all overrides", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "ctrl+1");
    manager.addOverride("action.b", "ctrl+2");
    expect(manager.getOverrides().length).toBe(2);

    manager.resetToDefaults();
    expect(manager.getOverrides().length).toBe(0);
    const lastSaved = persistence.saved[persistence.saved.length - 1];
    expect(lastSaved).toBeTruthy();
    expect(lastSaved.length).toBe(0);
  });

  it("listConflicts returns structured conflict info across all layers", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("user.action", "ctrl+h");

    const conflicts = manager.listConflicts("ctrl+h");
    expect(conflicts.length).toBe(2);

    const defaultConflict = conflicts.find((c) => c.layer === "defaults");
    expect(defaultConflict).toBeTruthy();
    expect(defaultConflict?.action).toBe("shell.focus.left");

    const userConflict = conflicts.find((c) => c.layer === "user-overrides");
    expect(userConflict).toBeTruthy();
    expect(userConflict?.action).toBe("user.action");
  });

  it("listConflicts returns empty array for unused chord", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const conflicts = manager.listConflicts("ctrl+shift+alt+z");
    expect(conflicts.length).toBe(0);
  });

  it("getOverrides returns current state as defensive copy", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.x", "ctrl+x");
    const overrides = manager.getOverrides();
    expect(overrides.length).toBe(1);
    expect(overrides[0].action).toBe("action.x");
    expect(overrides[0].keybinding).toBe("ctrl+x");

    // Mutating the returned array should not affect the manager
    overrides.push({ action: "action.y", keybinding: "ctrl+y" });
    expect(manager.getOverrides().length).toBe(1);
  });

  it("overrides persist via persistence layer", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "ctrl+1");
    manager.addOverride("action.b", "ctrl+2");
    manager.removeOverride("action.a");

    expect(persistence.saved.length).toBe(3);
    const lastSaved = persistence.saved[2];
    expect(lastSaved.length).toBe(1);
    expect(lastSaved[0].action).toBe("action.b");
    expect(lastSaved[0].keybinding).toBe("ctrl+2");
  });

  it("addOverride with invalid keybinding fails gracefully", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("action.a", "+++");
    expect(result.success).toBe(false);
    expect(result.warning).toBe("Invalid keybinding sequence");
    expect(persistence.saved.length).toBe(0);
  });

  it("addOverride normalizes chord before storing", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "Shift + Ctrl + P");
    const overrides = manager.getOverrides();
    expect(overrides.length).toBe(1);
    expect(overrides[0].keybinding).toBe("ctrl+shift+p");
  });

  it("addOverride updates existing override for same action", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("action.a", "ctrl+1");
    manager.addOverride("action.a", "ctrl+2");
    const overrides = manager.getOverrides();
    expect(overrides.length).toBe(1);
    expect(overrides[0].keybinding).toBe("ctrl+2");
  });

  it("listConflicts with invalid chord returns empty array", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const conflicts = manager.listConflicts("+++");
    expect(conflicts.length).toBe(0);
  });

  it("manager initializes overrides from persistence.load()", () => {
    const persistence = createMockPersistence();
    // Pre-populate persistence with saved data via save
    persistence.save([{ action: "preloaded.action", keybinding: "ctrl+p" }]);

    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const overrides = manager.getOverrides();
    expect(overrides.length).toBe(1);
    expect(overrides[0].action).toBe("preloaded.action");
    expect(overrides[0].keybinding).toBe("ctrl+p");
  });

  it("listConflicts does not double-count when same binding appears in defaults only", () => {
    const persistence = createMockPersistence();
    // Simulate the FIXED wiring: defaults have ctrl+h, plugins do NOT have it
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [
        { action: "shell.focus.left", keybinding: "ctrl+h", pluginId: "com.ghost.shell.defaults" },
      ],
      getPluginBindings: () => [
        // No duplicate here — defaults are filtered out of plugin bindings
        { action: "plugin.action.search", keybinding: "ctrl+shift+f", pluginId: "com.ghost.plugin.search" },
      ],
    });

    const conflicts = manager.listConflicts("ctrl+h");
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].layer).toBe("defaults");
  });

  it("listConflicts correctly detects real cross-layer conflict", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [
        { action: "shell.focus.left", keybinding: "ctrl+h", pluginId: "com.ghost.shell.defaults" },
      ],
      getPluginBindings: () => [
        // A DIFFERENT action from a real plugin using the same chord — this IS a real conflict
        { action: "plugin.action.help", keybinding: "ctrl+h", pluginId: "com.ghost.plugin.help" },
      ],
    });

    const conflicts = manager.listConflicts("ctrl+h");
    expect(conflicts.length).toBe(2);
    const defaultConflict = conflicts.find((c) => c.layer === "defaults");
    const pluginConflict = conflicts.find((c) => c.layer === "plugins");
    expect(defaultConflict).toBeTruthy();
    expect(pluginConflict).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Sequence-aware conflict detection tests
  // ---------------------------------------------------------------------------

  it("addOverride with sequence string succeeds", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const result = manager.addOverride("custom.sequence.action", "ctrl+k c");
    expect(result.success).toBe(true);
    expect(result.warning).toBe(null);
    const overrides = manager.getOverrides();
    expect(overrides.length).toBe(1);
    expect(overrides[0].keybinding).toBe("ctrl+k c");
  });

  it("prefix conflict: adding sequence when single-chord prefix exists", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("first.action", "ctrl+k");
    const result = manager.addOverride("second.action", "ctrl+k c");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].action).toBe("first.action");
    expect(result.conflicts[0].conflictType).toBe("prefix");
    expect(result.conflicts[0].layer).toBe("user-overrides");
  });

  it("prefix conflict reverse: adding single-chord when sequence with that prefix exists", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("first.action", "ctrl+k c");
    const result = manager.addOverride("second.action", "ctrl+k");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].action).toBe("first.action");
    expect(result.conflicts[0].conflictType).toBe("prefix");
  });

  it("listConflicts with sequence returns proper conflictType", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [
        { action: "shell.chord.action", keybinding: "ctrl+k", pluginId: "com.ghost.shell.defaults" },
      ],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    const conflicts = manager.listConflicts("ctrl+k c");
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe("prefix");
    expect(conflicts[0].action).toBe("shell.chord.action");
  });

  it("no conflict between unrelated sequences", () => {
    const persistence = createMockPersistence();
    const manager = createKeybindingOverrideManager({
      persistence,
      getDefaultBindings: () => [...DEFAULT_BINDINGS],
      getPluginBindings: () => [...PLUGIN_BINDINGS],
    });

    manager.addOverride("first.action", "ctrl+k c");
    const result = manager.addOverride("second.action", "ctrl+j d");
    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(0);
  });
});
