import { describe, expect, it } from "vitest";
import type { NormalizedKeybindingChord, NormalizedKeybindingSequence } from "@ghost-shell/commands";
import {
  type KeybindingLayer,
  normalizeConfiguredChord,
  type RegisteredKeybindingRecord,
  resolveKeybindingMatch,
  resolveKeybindingSequence,
} from "@ghost-shell/commands";
import { createDefaultContributionPredicateMatcher } from "@ghost-shell/plugin-system";
import type { InvokableAction } from "../action-surface.js";
function chord(input: string): NormalizedKeybindingChord {
  const c = normalizeConfiguredChord(input);
  if (!c) throw new Error(`Invalid chord: ${input}`);
  return c;
}

function seq(...inputs: string[]): NormalizedKeybindingSequence {
  const chords = inputs.map(chord);
  return { chords, value: chords.map((c) => c.value).join(" ") };
}

function action(id: string): InvokableAction {
  return { id, title: id, intent: `intent.${id}`, pluginId: "test" };
}

function record(
  seqInputs: string[],
  layer: KeybindingLayer = "defaults",
  opts?: { when?: { role: string }; actionWhen?: { mode: string } },
): RegisteredKeybindingRecord {
  const act = action(seqInputs.join("-"));
  if (opts?.actionWhen) {
    (act as any).when = opts.actionWhen;
  }
  return {
    action: act,
    sequence: seq(...seqInputs),
    when: opts?.when,
    source: { layer, pluginId: "test" },
  };
}

describe("keybinding resolver", () => {
  it("single-chord sequence exact match", () => {
    const records = [record(["ctrl+k"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("ctrl+k");
  });

  it("two-chord sequence exact match", () => {
    const records = [record(["ctrl+k", "c"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k"), chord("c")], {});
    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("ctrl+k-c");
  });

  it("prefix match returns prefix kind with count", () => {
    const records = [record(["ctrl+k", "c"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    expect(result.kind).toBe("prefix");
    expect(result.prefixCount).toBe(1);
  });

  it("no match returns none", () => {
    const records = [record(["ctrl+k", "c"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+z")], {});
    expect(result.kind).toBe("none");
  });

  it("layer precedence — higher-priority layer wins", () => {
    const records = [record(["ctrl+k"], "user-overrides"), record(["ctrl+k"], "defaults")];
    // Overwrite action id for distinction
    records[0]!.action = { ...records[0]?.action, id: "override" };
    records[1]!.action = { ...records[1]?.action, id: "default" };
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("override");
  });

  it("predicate gating on exact match skips failing record", () => {
    const matcher = createDefaultContributionPredicateMatcher();
    const records = [record(["ctrl+h"], "defaults", { when: { role: "admin" } })];
    const noMatch = resolveKeybindingSequence(records, [chord("ctrl+h")], { role: "operator" }, matcher);
    expect(noMatch.kind).toBe("none");

    const matched = resolveKeybindingSequence(records, [chord("ctrl+h")], { role: "admin" }, matcher);
    expect(matched.kind).toBe("exact");
  });

  it("empty pressedChords returns none", () => {
    const records = [record(["ctrl+k"])];
    const result = resolveKeybindingSequence(records, [], {});
    expect(result.kind).toBe("none");
  });

  it("multiple prefix matches counted correctly", () => {
    const records = [record(["ctrl+k", "c"]), record(["ctrl+k", "u"])];
    const result = resolveKeybindingSequence(records, [chord("ctrl+k")], {});
    expect(result.kind).toBe("prefix");
    expect(result.prefixCount).toBe(2);
  });

  it("backward compat: resolveKeybindingMatch works for single-chord records", () => {
    const records = [record(["ctrl+s"])];
    const result = resolveKeybindingMatch(records, chord("ctrl+s"), {});
    expect(result?.action.id).toBe("ctrl+s");
    expect(result?.sequence.value).toBe("ctrl+s");
  });
});
