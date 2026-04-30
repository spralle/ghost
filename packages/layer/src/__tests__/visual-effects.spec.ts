import { describe, expect, it } from "vitest";
import { applyVisualEffects, setDynamicOpacity } from "../visual-effects.js";

function makeElement(): HTMLElement {
  const style: Record<string, string> = {};
  return { style } as unknown as HTMLElement;
}

describe("visual-effects", () => {
  // ---------------------------------------------------------------------------
  // applyVisualEffects
  // ---------------------------------------------------------------------------

  it("applyVisualEffects with opacity only", () => {
    const el = makeElement();
    applyVisualEffects(el, 0.5);
    expect(el.style.opacity).toBe("0.5");
    expect(el.style.backdropFilter).toBe("");
  });

  it("applyVisualEffects with backdropFilter only", () => {
    const el = makeElement();
    applyVisualEffects(el, undefined, "blur(12px)");
    expect(el.style.opacity).toBe("");
    expect(el.style.backdropFilter).toBe("blur(12px)");
    expect((el.style as unknown as Record<string, string>).webkitBackdropFilter).toBe("blur(12px)");
  });

  it("applyVisualEffects with both", () => {
    const el = makeElement();
    applyVisualEffects(el, 0.8, "blur(8px)");
    expect(el.style.opacity).toBe("0.8");
    expect(el.style.backdropFilter).toBe("blur(8px)");
    expect((el.style as unknown as Record<string, string>).webkitBackdropFilter).toBe("blur(8px)");
  });

  it("applyVisualEffects with defaults (no opacity, no filter)", () => {
    const el = makeElement();
    // Pre-set values to verify they get cleared
    el.style.opacity = "0.5";
    el.style.backdropFilter = "blur(4px)";
    (el.style as unknown as Record<string, string>).webkitBackdropFilter = "blur(4px)";

    applyVisualEffects(el);
    expect(el.style.opacity).toBe("");
    expect(el.style.backdropFilter).toBe("");
    expect((el.style as unknown as Record<string, string>).webkitBackdropFilter).toBe("");
  });

  it("applyVisualEffects with opacity=1 resets to default", () => {
    const el = makeElement();
    el.style.opacity = "0.5";
    applyVisualEffects(el, 1);
    expect(el.style.opacity).toBe("");
  });

  // ---------------------------------------------------------------------------
  // setDynamicOpacity
  // ---------------------------------------------------------------------------

  it("setDynamicOpacity sets value", () => {
    const el = makeElement();
    setDynamicOpacity(el, 0.7);
    expect(el.style.opacity).toBe("0.7");
  });

  it("setDynamicOpacity clamps below 0", () => {
    const el = makeElement();
    setDynamicOpacity(el, -0.5);
    expect(el.style.opacity).toBe("0");
  });

  it("setDynamicOpacity clamps above 1", () => {
    const el = makeElement();
    setDynamicOpacity(el, 1.5);
    expect(el.style.opacity).toBe("1");
  });
});
