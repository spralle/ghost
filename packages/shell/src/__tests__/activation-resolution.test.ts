import { describe, expect, it } from "vitest";
import { matchesWhen, resolveActivationEntry } from "../activation-resolution.js";
import type { PluginContract } from "@ghost-shell/contracts";

function makeContract(activations?: PluginContract["activations"]): PluginContract {
  return {
    manifest: { id: "test-plugin", name: "Test", version: "1.0.0" },
    activations,
  };
}

describe("resolveActivationEntry", () => {
  it("returns null when no activations array", () => {
    const result = resolveActivationEntry(makeContract(undefined), {}, {});
    expect(result).toBeNull();
  });

  it("returns null when activations array is empty", () => {
    const result = resolveActivationEntry(makeContract([]), {}, {});
    expect(result).toBeNull();
  });

  it("returns matching export when when-clause matches", () => {
    const fn = () => {};
    const contract = makeContract([{ entry: "activateSecondary", when: { isSecondary: true } }]);
    const result = resolveActivationEntry(contract, { activateSecondary: fn }, { isSecondary: true });
    expect(result).toBe(fn);
  });

  it("returns null when no when-clause matches", () => {
    const fn = () => {};
    const contract = makeContract([{ entry: "activateSecondary", when: { isSecondary: true } }]);
    const result = resolveActivationEntry(contract, { activateSecondary: fn }, { isSecondary: false });
    expect(result).toBeNull();
  });

  it("first match wins with multiple rules", () => {
    const fn1 = () => {};
    const fn2 = () => {};
    const contract = makeContract([
      { entry: "first", when: { isSecondary: true } },
      { entry: "second", when: { isSecondary: true } },
    ]);
    const result = resolveActivationEntry(contract, { first: fn1, second: fn2 }, { isSecondary: true });
    expect(result).toBe(fn1);
  });

  it("skips rule when entry name not in exports", () => {
    const fn = () => {};
    const contract = makeContract([
      { entry: "missing", when: { isSecondary: true } },
      { entry: "present", when: { isSecondary: true } },
    ]);
    const result = resolveActivationEntry(contract, { present: fn }, { isSecondary: true });
    expect(result).toBe(fn);
  });
});

describe("matchesWhen", () => {
  it("matches simple equality", () => {
    expect(matchesWhen({ isSecondary: true }, { isSecondary: true })).toBe(true);
  });

  it("fails on inequality", () => {
    expect(matchesWhen({ isSecondary: false }, { isSecondary: true })).toBe(false);
  });

  it("supports $eq operator", () => {
    expect(matchesWhen({ mode: "dark" }, { mode: { $eq: "dark" } })).toBe(true);
    expect(matchesWhen({ mode: "light" }, { mode: { $eq: "dark" } })).toBe(false);
  });

  it("supports $ne operator", () => {
    expect(matchesWhen({ mode: "dark" }, { mode: { $ne: "light" } })).toBe(true);
    expect(matchesWhen({ mode: "dark" }, { mode: { $ne: "dark" } })).toBe(false);
  });

  it("matches empty when clause (always true)", () => {
    expect(matchesWhen({ anything: 42 }, {})).toBe(true);
  });
});
