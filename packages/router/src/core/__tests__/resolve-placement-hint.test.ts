import { describe, expect, it } from "vitest";
import { resolvePlacementHint } from "../resolve-placement-hint.js";

describe("resolvePlacementHint", () => {
  it("split with maxPanes=Infinity returns split", () => {
    expect(resolvePlacementHint("split", { maxPanes: Infinity })).toBe("split");
  });

  it("split with maxPanes=1 degrades to auto", () => {
    expect(resolvePlacementHint("split", { maxPanes: 1 })).toBe("auto");
  });

  it("detach with maxPanes=2 returns detach", () => {
    expect(resolvePlacementHint("detach", { maxPanes: 2 })).toBe("detach");
  });

  it("detach with maxPanes=1 degrades to auto", () => {
    expect(resolvePlacementHint("detach", { maxPanes: 1 })).toBe("auto");
  });

  it("background passes through regardless of maxPanes", () => {
    expect(resolvePlacementHint("background", { maxPanes: 1 })).toBe("background");
    expect(resolvePlacementHint("background", { maxPanes: 4 })).toBe("background");
  });

  it("auto passes through unchanged", () => {
    expect(resolvePlacementHint("auto", { maxPanes: 1 })).toBe("auto");
  });

  it("replace passes through unchanged", () => {
    expect(resolvePlacementHint("replace", { maxPanes: 1 })).toBe("replace");
  });
});
