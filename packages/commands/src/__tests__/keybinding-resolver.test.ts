import { describe, expect, test } from "vitest";
import type { ActionSurfaceContext } from "../action-surface.js";
import { normalizeConfiguredChord, normalizeConfiguredSequence } from "../keybinding-normalizer.js";
import type { RegisteredKeybindingRecord } from "../keybinding-resolver.js";
import { resolveKeybindingMatch, resolveKeybindingSequence } from "../keybinding-resolver.js";

function makeRecord(
  actionId: string,
  keybinding: string,
  opts?: { when?: undefined; layer?: "defaults" | "plugins" | "user-overrides" },
): RegisteredKeybindingRecord {
  const sequence = normalizeConfiguredSequence(keybinding)!;
  return {
    action: {
      id: actionId,
      title: actionId,
      intent: `intent.${actionId}`,
      pluginId: "test-plugin",
    },
    sequence,
    when: opts?.when,
    source: { layer: opts?.layer ?? "defaults", pluginId: "test-plugin" },
  };
}

const emptyContext: ActionSurfaceContext = {};

// Provide a matcher that always returns matched:true for undefined predicates
const alwaysTrueMatcher = {
  evaluate: () => ({ matched: true }),
};

describe("resolveKeybindingSequence", () => {
  test("returns 'none' for empty pressed chords", () => {
    const result = resolveKeybindingSequence([], [], emptyContext, alwaysTrueMatcher as any);
    expect(result.kind).toBe("none");
  });

  test("returns 'exact' when chord matches a single-chord binding", () => {
    const records = [makeRecord("save", "ctrl+s")];
    const chord = normalizeConfiguredChord("ctrl+s")!;
    const result = resolveKeybindingSequence(records, [chord], emptyContext, alwaysTrueMatcher as any);
    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("save");
  });

  test("returns 'none' when no chord matches", () => {
    const records = [makeRecord("save", "ctrl+s")];
    const chord = normalizeConfiguredChord("ctrl+d")!;
    const result = resolveKeybindingSequence(records, [chord], emptyContext, alwaysTrueMatcher as any);
    expect(result.kind).toBe("none");
  });

  test("returns 'prefix' when pressed chord is prefix of a multi-chord binding", () => {
    const records = [makeRecord("special", "ctrl+k ctrl+s")];
    const chord = normalizeConfiguredChord("ctrl+k")!;
    const result = resolveKeybindingSequence(records, [chord], emptyContext, alwaysTrueMatcher as any);
    expect(result.kind).toBe("prefix");
    expect(result.prefixCount).toBe(1);
  });

  test("returns 'exact' for full multi-chord sequence match", () => {
    const records = [makeRecord("special", "ctrl+k ctrl+s")];
    const chords = [normalizeConfiguredChord("ctrl+k")!, normalizeConfiguredChord("ctrl+s")!];
    const result = resolveKeybindingSequence(records, chords, emptyContext, alwaysTrueMatcher as any);
    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("special");
  });

  test("first matching record wins", () => {
    const records = [makeRecord("first", "ctrl+s"), makeRecord("second", "ctrl+s")];
    const chord = normalizeConfiguredChord("ctrl+s")!;
    const result = resolveKeybindingSequence(records, [chord], emptyContext, alwaysTrueMatcher as any);
    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("first");
  });
});

describe("resolveKeybindingMatch", () => {
  test("returns match for single chord", () => {
    const records = [makeRecord("open", "ctrl+o")];
    const chord = normalizeConfiguredChord("ctrl+o")!;
    const result = resolveKeybindingMatch(records, chord, emptyContext, alwaysTrueMatcher as any);
    expect(result).not.toBeNull();
    expect(result?.action.id).toBe("open");
  });

  test("returns null when no match", () => {
    const records = [makeRecord("open", "ctrl+o")];
    const chord = normalizeConfiguredChord("ctrl+p")!;
    const result = resolveKeybindingMatch(records, chord, emptyContext, alwaysTrueMatcher as any);
    expect(result).toBeNull();
  });
});
