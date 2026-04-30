import { describe, expect, test } from "vitest";
import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { evaluateContributionPredicate } from "@ghost-shell/plugin-system";

/**
 * Mirrors the filterByWhenCondition logic from surface-renderer.ts
 * to test when-condition evaluation without module federation dependencies.
 */
function filterByWhenCondition(
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
  facts: Record<string, unknown> = {},
): Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }> {
  return surfaces.filter((entry) => evaluateContributionPredicate(entry.surface.when, facts));
}

function makeSurface(
  id: string,
  when?: Record<string, unknown>,
): { pluginId: string; surface: PluginLayerSurfaceContribution } {
  return {
    pluginId: "test-plugin",
    surface: {
      id,
      component: `comp-${id}`,
      layer: "overlay",
      anchor: 0,
      when,
    },
  };
}

describe("filterByWhenCondition", () => {
  test("when is undefined → surface passes", () => {
    const surfaces = [makeSurface("a")];
    const result = filterByWhenCondition(surfaces);
    expect(result).toHaveLength(1);
    expect(result[0].surface.id).toBe("a");
  });

  test("when is empty object → surface passes", () => {
    const surfaces = [makeSurface("a", {})];
    const result = filterByWhenCondition(surfaces);
    expect(result).toHaveLength(1);
  });

  test("when evaluates to true → surface passes", () => {
    const surfaces = [makeSurface("a", { mode: "desktop" })];
    const result = filterByWhenCondition(surfaces, { mode: "desktop" });
    expect(result).toHaveLength(1);
  });

  test("when evaluates to false → surface excluded", () => {
    const surfaces = [makeSurface("a", { mode: "desktop" })];
    const result = filterByWhenCondition(surfaces, { mode: "mobile" });
    expect(result).toHaveLength(0);
  });

  test("mixed when conditions filter correctly", () => {
    const surfaces = [
      makeSurface("visible", { mode: "desktop" }),
      makeSurface("hidden", { mode: "mobile" }),
      makeSurface("always"),
    ];
    const result = filterByWhenCondition(surfaces, { mode: "desktop" });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.surface.id)).toEqual(["visible", "always"]);
  });

  test("surface removed when when-condition changes from true to false", () => {
    const surfaces = [makeSurface("toggle", { enabled: true })];

    const pass1 = filterByWhenCondition(surfaces, { enabled: true });
    expect(pass1).toHaveLength(1);

    const pass2 = filterByWhenCondition(surfaces, { enabled: false });
    expect(pass2).toHaveLength(0);
  });
});
