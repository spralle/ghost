import { describe, expect, it } from "vitest";
import { DEFAULT_MOTION_CONFIG } from "../config-defaults.js";
import type { GhostMotionConfig } from "../config-types.js";
import { generateMotionCss } from "../css-generator.js";

describe("generateMotionCss", () => {
  it("returns empty string when config.enabled is false", () => {
    const config: GhostMotionConfig = { ...DEFAULT_MOTION_CONFIG, enabled: false };
    expect(generateMotionCss(config)).toBe("");
  });

  it("enabled animation produces CSS block scoped under [data-ghost-motion]", () => {
    const css = generateMotionCss(DEFAULT_MOTION_CONFIG);
    expect(css).toContain("[data-ghost-motion]");
  });

  it("disabled animation produces no CSS block", () => {
    const config: GhostMotionConfig = {
      ...DEFAULT_MOTION_CONFIG,
      animations: {
        ...DEFAULT_MOTION_CONFIG.animations,
        borderangle: { enabled: false },
      },
    };
    const css = generateMotionCss(config);
    expect(css).not.toContain("ghost-border-rotate");
  });

  it("will-change only appears inside [data-motion selectors", () => {
    const css = generateMotionCss(DEFAULT_MOTION_CONFIG);
    const blocks = css.split("}");
    for (const block of blocks) {
      if (block.includes("will-change")) {
        expect(block).toContain("[data-motion");
      }
    }
  });

  it("unreferenced @keyframes are not emitted", () => {
    // With default config, windows uses popin style, so slide keyframes should not appear
    const config: GhostMotionConfig = {
      enabled: true,
      curves: DEFAULT_MOTION_CONFIG.curves,
      animations: {
        windows: { enabled: true, speed: 4, curve: "snappy", style: "popin", styleParam: 80 },
      },
    };
    const css = generateMotionCss(config);
    expect(css).not.toContain("ghost-window-slide-in");
  });

  it("transition-based nodes produce transition rules, not animation rules", () => {
    const css = generateMotionCss(DEFAULT_MOTION_CONFIG);
    // fade nodes use transition, not animation
    const fadeBlock = css.split("[data-ghost-motion] .dock-node-stack {")[1];
    if (fadeBlock) {
      const blockEnd = fadeBlock.indexOf("}");
      const content = fadeBlock.slice(0, blockEnd);
      expect(content).toContain("transition:");
      expect(content).not.toContain("animation:");
    }
  });

  it("style param sets --ghost-anim-param custom property", () => {
    const css = generateMotionCss(DEFAULT_MOTION_CONFIG);
    expect(css).toContain("--ghost-anim-param: 80");
  });
});
