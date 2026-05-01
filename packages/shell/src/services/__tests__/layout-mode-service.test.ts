// layout-mode-service.test.ts — Tests for the layout mode service.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutSignals } from "../layout-mode-types.js";
import { createLayoutModeService } from "../layout-mode-service.js";

function makeSignals(overrides: Partial<LayoutSignals> = {}): LayoutSignals {
  return {
    viewportWidth: 1280,
    viewportHeight: 800,
    pointer: "fine",
    hover: "hover",
    anyPointerFine: true,
    anyHoverHover: true,
    orientation: "landscape",
    standalone: false,
    devicePixelRatio: 1,
    ...overrides,
  };
}

function createTestService(signals: LayoutSignals, options?: Parameters<typeof createLayoutModeService>[0]) {
  return createLayoutModeService({
    signalSource: () => signals,
    config: { debounceMs: 0, hysteresisPx: 32 },
    ...options,
  });
}

describe("layout-mode-service", () => {
  // ─── ADR scenario rows ───

  describe("signal → mode resolution", () => {
    it("resolves narrow viewport (<600) to compact", () => {
      const s = createTestService(makeSignals({ viewportWidth: 400 }));
      expect(s.mode).toBe("compact");
      s.dispose();
    });

    it("resolves short touch viewport to compact", () => {
      const s = createTestService(makeSignals({ viewportHeight: 400, anyPointerFine: false, viewportWidth: 800 }));
      expect(s.mode).toBe("compact");
      s.dispose();
    });

    it("resolves medium touch-only (600-768, no fine pointer) to compact", () => {
      const s = createTestService(makeSignals({ viewportWidth: 650, anyPointerFine: false }));
      expect(s.mode).toBe("compact");
      s.dispose();
    });

    it("resolves medium viewport (600-1024) to medium", () => {
      const s = createTestService(makeSignals({ viewportWidth: 800 }));
      expect(s.mode).toBe("medium");
      s.dispose();
    });

    it("resolves wide touch-only (≥1024, no fine pointer, no hover) to medium", () => {
      const s = createTestService(makeSignals({
        viewportWidth: 1200,
        anyPointerFine: false,
        anyHoverHover: false,
      }));
      expect(s.mode).toBe("medium");
      s.dispose();
    });

    it("resolves wide viewport (≥1024) to expanded", () => {
      const s = createTestService(makeSignals({ viewportWidth: 1280 }));
      expect(s.mode).toBe("expanded");
      s.dispose();
    });

    it("resolves very narrow (320) to compact", () => {
      const s = createTestService(makeSignals({ viewportWidth: 320 }));
      expect(s.mode).toBe("compact");
      s.dispose();
    });

    it("resolves exactly 600 with fine pointer to medium", () => {
      const s = createTestService(makeSignals({ viewportWidth: 600 }));
      expect(s.mode).toBe("medium");
      s.dispose();
    });

    it("resolves exactly 1024 with fine pointer to expanded", () => {
      const s = createTestService(makeSignals({ viewportWidth: 1024 }));
      expect(s.mode).toBe("expanded");
      s.dispose();
    });
  });

  // ─── Fallback ───

  it("falls back to expanded when no rule matches", () => {
    const s = createLayoutModeService({
      rules: [{ name: "impossible", when: { viewportWidth: { $lt: -1 } }, mode: "compact" }],
      signalSource: () => makeSignals(),
      config: { debounceMs: 0, hysteresisPx: 32 },
    });
    expect(s.mode).toBe("expanded");
    s.dispose();
  });

  // ─── User override ───

  describe("user override", () => {
    it("bypasses rules when override is set", () => {
      const s = createTestService(makeSignals({ viewportWidth: 400 }));
      expect(s.mode).toBe("compact");
      s.setOverride({ mode: "expanded" });
      expect(s.mode).toBe("expanded");
      expect(s.isOverridden).toBe(true);
      s.dispose();
    });

    it("reverts to rules when override is cleared", () => {
      const s = createTestService(makeSignals({ viewportWidth: 400 }));
      s.setOverride({ mode: "expanded" });
      s.setOverride({ mode: null });
      expect(s.mode).toBe("compact");
      expect(s.isOverridden).toBe(false);
      s.dispose();
    });

    it("fires onDidChangeMode when override changes mode", () => {
      const s = createTestService(makeSignals({ viewportWidth: 400 }));
      const modes: string[] = [];
      s.onDidChangeMode((m) => modes.push(m));
      s.setOverride({ mode: "expanded" });
      expect(modes).toEqual(["expanded"]);
      s.dispose();
    });
  });

  // ─── Hysteresis ───

  describe("hysteresis", () => {
    it("blocks mode change when crossing boundary by less than hysteresis", () => {
      let current = makeSignals({ viewportWidth: 500 });
      const s = createLayoutModeService({
        signalSource: () => current,
        config: { debounceMs: 0, hysteresisPx: 32 },
      });
      expect(s.mode).toBe("compact");

      const modes: string[] = [];
      s.onDidChangeMode((m) => modes.push(m));

      // Move to 605 — crosses 600 boundary going up, first crossing always allowed
      current = makeSignals({ viewportWidth: 605 });
      s.notifySignalsChanged();
      expect(s.mode).toBe("medium");
      expect(modes).toEqual(["medium"]);

      // Move back to 595 — only 10px below 605, within 32px hysteresis
      current = makeSignals({ viewportWidth: 595 });
      s.notifySignalsChanged();
      expect(s.mode).toBe("medium"); // should NOT revert
      expect(modes).toEqual(["medium"]);

      s.dispose();
    });

    it("allows mode change when crossing boundary by more than hysteresis", () => {
      let current = makeSignals({ viewportWidth: 500 });
      const s = createLayoutModeService({
        signalSource: () => current,
        config: { debounceMs: 0, hysteresisPx: 32 },
      });
      expect(s.mode).toBe("compact");

      const modes: string[] = [];
      s.onDidChangeMode((m) => modes.push(m));

      // Cross 600 boundary going up — first crossing allowed
      current = makeSignals({ viewportWidth: 640 });
      s.notifySignalsChanged();
      expect(s.mode).toBe("medium");
      expect(modes).toEqual(["medium"]);

      // Cross back down past hysteresis zone (640 - 32 = 608, need < 600)
      current = makeSignals({ viewportWidth: 560 });
      s.notifySignalsChanged();
      expect(s.mode).toBe("compact");
      expect(modes).toEqual(["medium", "compact"]);

      s.dispose();
    });

    it("blocks then allows after exceeding hysteresis threshold", () => {
      let current = makeSignals({ viewportWidth: 500 });
      const s = createLayoutModeService({
        signalSource: () => current,
        config: { debounceMs: 0, hysteresisPx: 32 },
      });
      expect(s.mode).toBe("compact");

      const modes: string[] = [];
      s.onDidChangeMode((m) => modes.push(m));

      // First crossing up — allowed
      current = makeSignals({ viewportWidth: 610 });
      s.notifySignalsChanged();
      expect(modes).toEqual(["medium"]);

      // Try to go back within hysteresis — blocked
      current = makeSignals({ viewportWidth: 590 });
      s.notifySignalsChanged();
      expect(modes).toEqual(["medium"]);

      // Go further down past hysteresis — allowed
      current = makeSignals({ viewportWidth: 550 });
      s.notifySignalsChanged();
      expect(modes).toEqual(["medium", "compact"]);

      s.dispose();
    });
  });

  // ─── Debounce ───

  describe("debounce", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("coalesces rapid signal changes into a single mode change", () => {
      let current = makeSignals({ viewportWidth: 500 });
      const s = createLayoutModeService({
        signalSource: () => current,
        config: { debounceMs: 150, hysteresisPx: 32 },
      });
      expect(s.mode).toBe("compact");

      const modes: string[] = [];
      s.onDidChangeMode((m) => modes.push(m));

      // Rapid changes — each resets the debounce timer
      current = makeSignals({ viewportWidth: 610 });
      s.notifySignalsChanged();
      current = makeSignals({ viewportWidth: 620 });
      s.notifySignalsChanged();
      current = makeSignals({ viewportWidth: 640 });
      s.notifySignalsChanged();

      // Nothing fired yet — still within debounce window
      expect(modes).toEqual([]);

      // Advance past debounce
      vi.advanceTimersByTime(150);

      // Only one mode change event
      expect(modes).toEqual(["medium"]);
      expect(s.mode).toBe("medium");

      s.dispose();
    });

    it("does not fire if signals revert within debounce window", () => {
      let current = makeSignals({ viewportWidth: 500 });
      const s = createLayoutModeService({
        signalSource: () => current,
        config: { debounceMs: 150, hysteresisPx: 32 },
      });
      expect(s.mode).toBe("compact");

      const modes: string[] = [];
      s.onDidChangeMode((m) => modes.push(m));

      // Cross boundary then revert before debounce fires
      current = makeSignals({ viewportWidth: 640 });
      s.notifySignalsChanged();
      current = makeSignals({ viewportWidth: 500 });
      s.notifySignalsChanged();

      vi.advanceTimersByTime(150);

      // No mode change — reverted to same signals
      expect(modes).toEqual([]);
      expect(s.mode).toBe("compact");

      s.dispose();
    });
  });

  // ─── Custom rules and modes ───

  describe("custom rules and modes", () => {
    it("uses custom rules", () => {
      const s = createLayoutModeService({
        rules: [{ name: "always-custom", when: { viewportWidth: { $gte: 0 } }, mode: "custom" }],
        modes: { custom: { tabStripPosition: "top", maxPanes: 3, dockStrategy: "custom" } },
        signalSource: () => makeSignals(),
        config: { debounceMs: 0, hysteresisPx: 32 },
      });
      expect(s.mode).toBe("custom");
      expect(s.capabilities.maxPanes).toBe(3);
      s.dispose();
    });
  });

  // ─── Context facts ───

  describe("getContextFacts", () => {
    it("returns correct context facts for compact mode", () => {
      const s = createTestService(makeSignals({ viewportWidth: 400, pointer: "coarse", hover: "none", orientation: "portrait" }));
      const facts = s.getContextFacts();
      expect(facts["layout.mode"]).toBe("compact");
      expect(facts["layout.tabStripPosition"]).toBe("bottom");
      expect(facts["layout.maxPanes"]).toBe(1);
      expect(facts["layout.dockStrategy"]).toBe("stack");
      expect(facts["layout.pointer"]).toBe("coarse");
      expect(facts["layout.hover"]).toBe("none");
      expect(facts["layout.orientation"]).toBe("portrait");
      expect(facts["layout.standalone"]).toBe(false);
      s.dispose();
    });

    it("returns correct context facts for expanded mode", () => {
      const s = createTestService(makeSignals({ viewportWidth: 1280 }));
      const facts = s.getContextFacts();
      expect(facts["layout.mode"]).toBe("expanded");
      expect(facts["layout.tabStripPosition"]).toBe("top");
      expect(facts["layout.maxPanes"]).toBe(Infinity);
      expect(facts["layout.dockStrategy"]).toBe("dwindle");
      s.dispose();
    });
  });

  // ─── Event firing ───

  describe("events", () => {
    it("fires onDidChangeMode when override changes effective mode", () => {
      const s = createTestService(makeSignals({ viewportWidth: 1280 }));
      const fired: string[] = [];
      s.onDidChangeMode((m) => fired.push(m));
      s.setOverride({ mode: "compact" });
      expect(fired).toEqual(["compact"]);
      s.dispose();
    });

    it("does not fire onDidChangeMode when override sets same mode", () => {
      const s = createTestService(makeSignals({ viewportWidth: 1280 }));
      const fired: string[] = [];
      s.onDidChangeMode((m) => fired.push(m));
      s.setOverride({ mode: "expanded" }); // same as current
      expect(fired).toEqual([]);
      s.dispose();
    });
  });

  // ─── Capabilities ───

  describe("capabilities", () => {
    it("returns correct capabilities for each standard mode", () => {
      const compact = createTestService(makeSignals({ viewportWidth: 400 }));
      expect(compact.capabilities.tabStripPosition).toBe("bottom");
      expect(compact.capabilities.maxPanes).toBe(1);
      compact.dispose();

      const medium = createTestService(makeSignals({ viewportWidth: 800 }));
      expect(medium.capabilities.tabStripPosition).toBe("bottom");
      expect(medium.capabilities.maxPanes).toBe(2);
      medium.dispose();

      const expanded = createTestService(makeSignals({ viewportWidth: 1280 }));
      expect(expanded.capabilities.tabStripPosition).toBe("top");
      expect(expanded.capabilities.maxPanes).toBe(Infinity);
      expanded.dispose();
    });
  });

  // ─── Dispose ───

  it("cleans up on dispose without errors", () => {
    const s = createTestService(makeSignals());
    expect(() => s.dispose()).not.toThrow();
  });
});
