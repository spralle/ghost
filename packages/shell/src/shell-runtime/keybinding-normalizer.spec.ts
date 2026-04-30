import { describe, expect, it } from "vitest";
import { normalizeConfiguredChord, normalizeConfiguredSequence } from "@ghost-shell/commands";
describe("keybinding normalizer", () => {
  it("normalizeConfiguredSequence parses two-chord sequence", () => {
    const result = normalizeConfiguredSequence("ctrl+k c");
    expect(result).toBeTruthy();
    expect(result?.chords.length).toBe(2);
    expect(result?.chords[0]?.value).toBe("ctrl+k");
    expect(result?.chords[1]?.value).toBe("c");
    expect(result?.value).toBe("ctrl+k c");
  });

  it("normalizeConfiguredSequence parses three-chord sequence", () => {
    const result = normalizeConfiguredSequence("ctrl+shift+alt+g o d");
    expect(result).toBeTruthy();
    expect(result?.chords.length).toBe(3);
    expect(result?.value).toBe("ctrl+shift+alt+g o d");
  });

  it("normalizeConfiguredSequence parses single-chord sequence", () => {
    const result = normalizeConfiguredSequence("ctrl+shift+p");
    expect(result).toBeTruthy();
    expect(result?.chords.length).toBe(1);
    expect(result?.value).toBe("ctrl+shift+p");
  });

  it("normalizeConfiguredSequence returns null for empty string", () => {
    expect(normalizeConfiguredSequence("")).toBe(null);
  });

  it("normalizeConfiguredSequence returns null for whitespace-only string", () => {
    expect(normalizeConfiguredSequence("   ")).toBe(null);
  });

  it("normalizeConfiguredSequence returns null when any token is invalid", () => {
    expect(normalizeConfiguredSequence("ctrl+k +++")).toBe(null);
  });

  it("normalizeConfiguredSequence normalizes each token independently", () => {
    const result = normalizeConfiguredSequence("Shift + Ctrl + P");
    expect(result).toBeTruthy();
    expect(result?.chords.length).toBe(1);
    expect(result?.value).toBe("ctrl+shift+p");
  });

  it("normalizeConfiguredSequence handles multiple spaces between tokens", () => {
    const result = normalizeConfiguredSequence("ctrl+k  c");
    expect(result).toBeTruthy();
    expect(result?.chords.length).toBe(2);
    expect(result?.value).toBe("ctrl+k c");
  });

  it("normalizeConfiguredChord regression: canonical ordering", () => {
    const result = normalizeConfiguredChord("ctrl+shift+p");
    expect(result).toBeTruthy();
    expect(result?.value).toBe("ctrl+shift+p");
  });

  it("normalizeConfiguredChord regression: reorders modifiers canonically", () => {
    const result = normalizeConfiguredChord("Shift+Ctrl+P");
    expect(result).toBeTruthy();
    expect(result?.value).toBe("ctrl+shift+p");
  });
});
