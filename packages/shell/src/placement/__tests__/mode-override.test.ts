import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PlacementConfig, PlacementStrategyId, PlacementStrategyRegistry, TabPlacementStrategy } from "@ghost-shell/state";

// Mock the layout mode service registration module
vi.mock("../../services/layout-mode-service-registration.js", () => ({
  getLayoutModeService: vi.fn(() => null),
}));

import { getLayoutModeService } from "../../services/layout-mode-service-registration.js";
import { getEffectiveStrategy, getEffectivePlacementConfig } from "../get-effective-strategy.js";

const mockGetLayoutModeService = vi.mocked(getLayoutModeService);

function createMockStrategy(id: PlacementStrategyId): TabPlacementStrategy {
  return {
    id,
    place: vi.fn() as never,
  };
}

function createMockRegistry(strategies: TabPlacementStrategy[]): PlacementStrategyRegistry {
  const map = new Map(strategies.map((s) => [s.id, s]));
  return {
    register: vi.fn(),
    get: (id: PlacementStrategyId) => map.get(id),
    getActive: (config: PlacementConfig) => map.get(config.strategy) ?? map.get("tabs")!,
    list: () => [...map.values()],
  };
}

describe("getEffectiveStrategy", () => {
  const stackStrategy = createMockStrategy("stack");
  const dwindleStrategy = createMockStrategy("dwindle");
  const tabsStrategy = createMockStrategy("tabs");
  const registry = createMockRegistry([tabsStrategy, dwindleStrategy, stackStrategy]);

  beforeEach(() => {
    mockGetLayoutModeService.mockReturnValue(null);
  });

  it("returns workspace config strategy when no mode service", () => {
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    const result = getEffectiveStrategy(registry, config);
    expect(result.id).toBe("dwindle");
  });

  it("forces stack strategy when mode dockStrategy is 'stack'", () => {
    mockGetLayoutModeService.mockReturnValue({
      capabilities: { dockStrategy: "stack", maxPanes: 1, tabStripPosition: "bottom" },
    } as never);
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    const result = getEffectiveStrategy(registry, config);
    expect(result.id).toBe("stack");
  });

  it("uses workspace config when mode dockStrategy matches config", () => {
    mockGetLayoutModeService.mockReturnValue({
      capabilities: { dockStrategy: "dwindle", maxPanes: 4, tabStripPosition: "top" },
    } as never);
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    const result = getEffectiveStrategy(registry, config);
    expect(result.id).toBe("dwindle");
  });

  it("restores workspace strategy when mode switches from compact to expanded", () => {
    // Compact mode
    mockGetLayoutModeService.mockReturnValue({
      capabilities: { dockStrategy: "stack", maxPanes: 1, tabStripPosition: "bottom" },
    } as never);
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    expect(getEffectiveStrategy(registry, config).id).toBe("stack");

    // Switch to expanded mode
    mockGetLayoutModeService.mockReturnValue({
      capabilities: { dockStrategy: "dwindle", maxPanes: 4, tabStripPosition: "top" },
    } as never);
    expect(getEffectiveStrategy(registry, config).id).toBe("dwindle");
  });
});

describe("getEffectivePlacementConfig", () => {
  beforeEach(() => {
    mockGetLayoutModeService.mockReturnValue(null);
  });

  it("returns original config when no mode service", () => {
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    expect(getEffectivePlacementConfig(config)).toBe(config);
  });

  it("overrides strategy in config when mode differs", () => {
    mockGetLayoutModeService.mockReturnValue({
      capabilities: { dockStrategy: "stack", maxPanes: 1, tabStripPosition: "bottom" },
    } as never);
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    const result = getEffectivePlacementConfig(config);
    expect(result.strategy).toBe("stack");
    expect(result.dwindleDirection).toBe("alternate");
  });
});
