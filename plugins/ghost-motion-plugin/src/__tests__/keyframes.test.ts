import { describe, expect, it } from "vitest";
import { KEYFRAMES_REGISTRY } from "../keyframes.js";

describe("KEYFRAMES_REGISTRY", () => {
  it("all keyframes are valid CSS (contain @keyframes and braces)", () => {
    for (const [name, css] of Object.entries(KEYFRAMES_REGISTRY)) {
      expect(css).toContain(`@keyframes ${name}`);
      expect(css).toContain("{");
      expect(css).toContain("}");
    }
  });

  it("only transform and opacity properties used (no layout/paint props)", () => {
    const forbidden = ["width", "height", "top", "left", "right", "bottom", "margin", "padding"];
    for (const [, css] of Object.entries(KEYFRAMES_REGISTRY)) {
      for (const prop of forbidden) {
        // Match property declarations like "  width:" but not inside var() or calc()
        const regex = new RegExp(`^\\s+${prop}\\s*:`, "m");
        expect(css).not.toMatch(regex);
      }
    }
  });

  it("all entries in KEYFRAMES_REGISTRY have matching names", () => {
    for (const [name, css] of Object.entries(KEYFRAMES_REGISTRY)) {
      expect(css).toContain(`@keyframes ${name}`);
    }
  });
});
