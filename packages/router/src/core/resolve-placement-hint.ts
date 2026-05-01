import type { PlacementHint } from "./types.js";

export interface PlacementCapabilities {
  readonly maxPanes: number;
}

/**
 * Resolve a PlacementHint based on layout capabilities.
 * Degrades hints that aren't supported in the current mode.
 */
export function resolvePlacementHint(
  hint: PlacementHint,
  capabilities: PlacementCapabilities,
): PlacementHint {
  switch (hint) {
    case "split":
      return capabilities.maxPanes > 1 ? "split" : "auto";
    case "detach":
      return capabilities.maxPanes > 1 ? "detach" : "auto";
    case "background":
      return "background";
    case "auto":
    case "replace":
      return hint;
    default:
      return "auto";
  }
}
