import type { PlacementHint } from "./types.js";

/** Viewport classification based on screen dimensions. */
export type ViewportType = "mobile" | "tablet" | "desktop";

/** Immutable snapshot of current viewport dimensions and classification. */
export interface ViewportInfo {
  readonly width: number;
  readonly height: number;
  readonly type: ViewportType;
}

/** Concrete placement after viewport-aware resolution. */
export type ConcretePlacement =
  | "auto"
  | "replace"
  | "split"
  | "background"
  | "detach"
  | "stack-push"
  | "modal";

/** Resolves a PlacementHint into a ConcretePlacement given viewport context. */
export interface ViewportStrategy {
  readonly id: string;
  resolve(hint: PlacementHint, viewport: ViewportInfo): ConcretePlacement;
}

const MOBILE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 1023;

export function createMobileStrategy(): ViewportStrategy {
  return {
    id: "mobile",
    resolve: (hint) => (hint === "detach" ? "modal" : "stack-push"),
  };
}

export function createDesktopStrategy(): ViewportStrategy {
  return {
    id: "desktop",
    resolve: (hint) => hint,
  };
}

export function createTabletStrategy(): ViewportStrategy {
  return {
    id: "tablet",
    resolve: (hint) =>
      hint === "detach" ? "modal" : hint === "split" ? "auto" : hint,
  };
}

/** Detect current viewport. Returns desktop defaults in non-browser environments. */
export function detectViewport(): ViewportInfo {
  if (typeof window === "undefined") {
    return { width: 1920, height: 1080, type: "desktop" };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const type = classifyViewport(width);
  return { width, height, type };
}

/** Classify a width value into a ViewportType. */
export function classifyViewport(width: number): ViewportType {
  if (width <= MOBILE_MAX_WIDTH) return "mobile";
  if (width <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

/** Select the appropriate strategy for a given viewport. */
export function selectStrategy(viewport: ViewportInfo): ViewportStrategy {
  switch (viewport.type) {
    case "mobile":
      return createMobileStrategy();
    case "tablet":
      return createTabletStrategy();
    case "desktop":
      return createDesktopStrategy();
  }
}
