import { describe, expect, it } from "vitest";
import { exportKeybindingOverrides, validateKeybindingImport } from "@ghost-shell/commands";
import type { KeybindingOverrideEntryV1 } from "@ghost-shell/persistence";
describe("keybinding import export", () => {
  // -------------------------------------------------------------------------
  // exportKeybindingOverrides
  // -------------------------------------------------------------------------

  it("exportKeybindingOverrides returns envelope with version 1", () => {
    const overrides: KeybindingOverrideEntryV1[] = [{ action: "shell.focus.left", keybinding: "ctrl+h" }];
    const envelope = exportKeybindingOverrides(overrides);
    expect(envelope.version).toBe(1);
    expect(envelope.exportedAt.length > 0).toBeTruthy();
    expect(envelope.overrides.length).toBe(1);
    expect(envelope.overrides[0].action).toBe("shell.focus.left");
    expect(envelope.overrides[0].keybinding).toBe("ctrl+h");
  });

  it("exportKeybindingOverrides strips extra properties from entries", () => {
    const overrides: KeybindingOverrideEntryV1[] = [{ action: "a", keybinding: "ctrl+a", removed: true }];
    const envelope = exportKeybindingOverrides(overrides);
    expect(envelope.overrides[0].action).toBe("a");
    expect(envelope.overrides[0].keybinding).toBe("ctrl+a");
    expect((envelope.overrides[0] as unknown as Record<string, unknown>).removed).toBe(undefined);
  });

  it("exportKeybindingOverrides with empty overrides returns empty array", () => {
    const envelope = exportKeybindingOverrides([]);
    expect(envelope.version).toBe(1);
    expect(envelope.overrides.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — valid cases
  // -------------------------------------------------------------------------

  it("validateKeybindingImport accepts valid import with known actions", () => {
    const known = new Set(["shell.focus.left", "shell.focus.right"]);
    const input = {
      version: 1,
      overrides: [
        { action: "shell.focus.left", keybinding: "ctrl+j" },
        { action: "shell.focus.right", keybinding: "ctrl+k" },
      ],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(2);
    expect(result.warnings.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it("validateKeybindingImport normalizes keybinding chords", () => {
    const known = new Set(["a"]);
    const input = { version: 1, overrides: [{ action: "a", keybinding: "Shift + Ctrl + P" }] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries[0].keybinding).toBe("ctrl+shift+p");
  });

  it("validateKeybindingImport warns for unknown actions but includes them", () => {
    const known = new Set(["shell.focus.left"]);
    const input = {
      version: 1,
      overrides: [{ action: "unknown.action", keybinding: "ctrl+u" }],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(1);
    expect(result.warnings.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — rejection cases
  // -------------------------------------------------------------------------

  it("validateKeybindingImport rejects non-object input", () => {
    const known = new Set<string>();
    const result = validateKeybindingImport("not an object", known);
    expect(result.success).toBe(false);
    expect(result.errors.length > 0).toBeTruthy();
  });

  it("validateKeybindingImport rejects null input", () => {
    const known = new Set<string>();
    const result = validateKeybindingImport(null, known);
    expect(result.success).toBe(false);
  });

  it("validateKeybindingImport rejects array input", () => {
    const known = new Set<string>();
    const result = validateKeybindingImport([1, 2, 3], known);
    expect(result.success).toBe(false);
  });

  it("validateKeybindingImport rejects unsupported version", () => {
    const known = new Set<string>();
    const input = { version: 99, overrides: [] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.errors[0].includes("version")).toBeTruthy();
  });

  it("validateKeybindingImport rejects missing overrides array", () => {
    const known = new Set<string>();
    const input = { version: 1 };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.errors[0].includes("overrides")).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — invalid entries
  // -------------------------------------------------------------------------

  it("validateKeybindingImport skips entry that is not an object", () => {
    const known = new Set(["a"]);
    const input = { version: 1, overrides: ["not-an-object", { action: "a", keybinding: "ctrl+a" }] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(1);
    expect(result.warnings.length).toBe(1);
  });

  it("validateKeybindingImport skips entry with empty action", () => {
    const known = new Set<string>();
    const input = { version: 1, overrides: [{ action: "", keybinding: "ctrl+a" }] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.warnings.length > 0).toBeTruthy();
  });

  it("validateKeybindingImport skips entry with empty keybinding", () => {
    const known = new Set<string>();
    const input = { version: 1, overrides: [{ action: "a", keybinding: "" }] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.warnings.length > 0).toBeTruthy();
  });

  it("validateKeybindingImport skips entry with invalid keybinding", () => {
    const known = new Set(["a"]);
    const input = { version: 1, overrides: [{ action: "a", keybinding: "+++" }] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.warnings.length > 0).toBeTruthy();
  });

  it("validateKeybindingImport keeps valid entries alongside invalid ones", () => {
    const known = new Set(["good.action"]);
    const input = {
      version: 1,
      overrides: [
        { action: "good.action", keybinding: "ctrl+g" },
        { action: "", keybinding: "ctrl+x" },
        { action: "good.action", keybinding: "+++" },
        42,
      ],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(1);
    expect(result.warnings.length).toBe(3);
  });

  it("validateKeybindingImport fails when all entries are invalid", () => {
    const known = new Set<string>();
    const input = {
      version: 1,
      overrides: [
        { action: "", keybinding: "ctrl+a" },
        { action: "b", keybinding: "+++" },
      ],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.errors.length > 0).toBeTruthy();
    expect(result.entries.length).toBe(0);
  });

  it("validateKeybindingImport succeeds for empty overrides array", () => {
    const known = new Set<string>();
    const input = { version: 1, overrides: [] };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // validateKeybindingImport — sequence keybindings
  // -------------------------------------------------------------------------

  it("validateKeybindingImport accepts two-chord sequence keybinding", () => {
    const known = new Set(["editor.comment"]);
    const input = {
      version: 1,
      overrides: [{ action: "editor.comment", keybinding: "ctrl+k c" }],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].keybinding).toBe("ctrl+k c");
    expect(result.warnings.length).toBe(0);
  });

  it("validateKeybindingImport accepts three-chord sequence keybinding", () => {
    const known = new Set(["deep.action"]);
    const input = {
      version: 1,
      overrides: [{ action: "deep.action", keybinding: "ctrl+shift+alt+g o d" }],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].keybinding).toBe("ctrl+shift+alt+g o d");
  });

  it("validateKeybindingImport warns for invalid token in sequence", () => {
    const known = new Set(["a"]);
    const input = {
      version: 1,
      overrides: [{ action: "a", keybinding: "ctrl+k +++" }],
    };
    const result = validateKeybindingImport(input, known);
    expect(result.success).toBe(false);
    expect(result.warnings.length > 0).toBeTruthy();
    expect(result.warnings[0].includes("invalid keybinding")).toBeTruthy();
  });

  it("validateKeybindingImport round-trips sequence keybindings through export", () => {
    const overrides: KeybindingOverrideEntryV1[] = [
      { action: "editor.comment", keybinding: "ctrl+k c" },
      { action: "shell.focus.left", keybinding: "ctrl+h" },
    ];
    const envelope = exportKeybindingOverrides(overrides);
    const known = new Set(["editor.comment", "shell.focus.left"]);
    const result = validateKeybindingImport(envelope, known);
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(2);
    expect(result.entries[0].keybinding).toBe("ctrl+k c");
    expect(result.entries[1].keybinding).toBe("ctrl+h");
  });
});
