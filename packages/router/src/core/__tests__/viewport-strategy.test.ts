import { describe, expect, it } from "vitest";

import type { PlacementHint } from "../types.js";
import type { ViewportInfo } from "../viewport-strategy.js";
import {
  classifyViewport,
  createDesktopStrategy,
  createMobileStrategy,
  createTabletStrategy,
  selectStrategy,
} from "../viewport-strategy.js";

const mobile: ViewportInfo = { width: 375, height: 667, type: "mobile" };
const tablet: ViewportInfo = { width: 800, height: 1024, type: "tablet" };
const desktop: ViewportInfo = { width: 1440, height: 900, type: "desktop" };

describe("createMobileStrategy", () => {
  const strategy = createMobileStrategy();

  it("resolves detach to modal", () => {
    expect(strategy.resolve("detach", mobile)).toBe("modal");
  });

  it("resolves all other hints to stack-push", () => {
    const hints: PlacementHint[] = ["auto", "replace", "split", "background"];
    for (const hint of hints) {
      expect(strategy.resolve(hint, mobile)).toBe("stack-push");
    }
  });
});

describe("createDesktopStrategy", () => {
  const strategy = createDesktopStrategy();

  it("passes through all hints unchanged", () => {
    const hints: PlacementHint[] = ["auto", "replace", "split", "background", "detach"];
    for (const hint of hints) {
      expect(strategy.resolve(hint, desktop)).toBe(hint);
    }
  });
});

describe("createTabletStrategy", () => {
  const strategy = createTabletStrategy();

  it("resolves detach to modal", () => {
    expect(strategy.resolve("detach", tablet)).toBe("modal");
  });

  it("resolves split to auto", () => {
    expect(strategy.resolve("split", tablet)).toBe("auto");
  });

  it("passes through other hints", () => {
    expect(strategy.resolve("auto", tablet)).toBe("auto");
    expect(strategy.resolve("replace", tablet)).toBe("replace");
    expect(strategy.resolve("background", tablet)).toBe("background");
  });
});

describe("classifyViewport", () => {
  it("classifies narrow widths as mobile", () => {
    expect(classifyViewport(375)).toBe("mobile");
    expect(classifyViewport(767)).toBe("mobile");
  });

  it("classifies medium widths as tablet", () => {
    expect(classifyViewport(768)).toBe("tablet");
    expect(classifyViewport(1023)).toBe("tablet");
  });

  it("classifies wide widths as desktop", () => {
    expect(classifyViewport(1024)).toBe("desktop");
    expect(classifyViewport(1920)).toBe("desktop");
  });
});

describe("selectStrategy", () => {
  it("returns mobile strategy for mobile viewport", () => {
    expect(selectStrategy(mobile).id).toBe("mobile");
  });

  it("returns tablet strategy for tablet viewport", () => {
    expect(selectStrategy(tablet).id).toBe("tablet");
  });

  it("returns desktop strategy for desktop viewport", () => {
    expect(selectStrategy(desktop).id).toBe("desktop");
  });
});
