// get-effective-strategy.ts — Resolves the active placement strategy with mode override.

import type { PlacementConfig, PlacementStrategyId, PlacementStrategyRegistry, TabPlacementStrategy } from "@ghost-shell/state";
import { getLayoutModeService } from "../services/layout-mode-service-registration.js";

/**
 * Returns the effective placement strategy, applying mode-based override
 * when the layout mode's dockStrategy differs from workspace config.
 *
 * When mode dockStrategy is "stack" (compact mode), the stack strategy is
 * forced regardless of workspace configuration.
 */
export function getEffectiveStrategy(
  registry: PlacementStrategyRegistry,
  config: PlacementConfig,
): TabPlacementStrategy {
  const effectiveConfig = getEffectivePlacementConfig(config);
  return registry.getActive(effectiveConfig);
}

/**
 * Returns a PlacementConfig with the strategy overridden by the current
 * layout mode's dockStrategy capability, if applicable.
 */
export function getEffectivePlacementConfig(config: PlacementConfig): PlacementConfig {
  const layoutService = getLayoutModeService();
  const modeStrategy = layoutService?.capabilities.dockStrategy;

  if (modeStrategy && modeStrategy !== config.strategy) {
    return { ...config, strategy: modeStrategy as PlacementStrategyId };
  }

  return config;
}
