import { describe, expect, it } from "vitest";
import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts/layer";
import { LayerRegistry } from "../registry.js";

function makeSurface(overrides: Partial<PluginLayerSurfaceContribution> = {}): PluginLayerSurfaceContribution {
  return {
    id: "test-surface",
    component: "./TestComponent",
    layer: "floating",
    anchor: 1,
    ...overrides,
  };
}

describe("registry", () => {
  // --- Built-in layer registration ---

  it("registerBuiltinLayers registers 7 layers", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const layers = reg.getOrderedLayers();
    expect(layers.length).toBe(7);
  });

  it("built-in layers have correct z-orders", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const layers = reg.getOrderedLayers();
    const zOrders = layers.map((l) => l.zOrder);
    expect(zOrders).toEqual([0, 100, 200, 300, 400, 500, 600]);
  });

  it("built-in layers have correct names in order", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const names = reg.getOrderedLayers().map((l) => l.name);
    expect(names).toEqual(
      ["background", "bottom", "main", "floating", "notification", "modal", "overlay"],
    );
  });

  // --- Plugin layer registration ---

  it("registerPluginLayers adds custom layers", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
    expect(result.registered.length).toBe(1);
    expect(result.denied.length).toBe(0);
    expect(reg.getLayer("custom")?.pluginId).toBe("plugin-a");
  });

  it("registerPluginLayers denies name conflicts with built-ins", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.registerPluginLayers("plugin-a", [{ name: "main", zOrder: 999 }]);
    expect(result.registered.length).toBe(0);
    expect(result.denied.length).toBe(1);
    expect(result.denied[0]?.name).toBe("main");
  });

  it("registerPluginLayers denies name conflicts with other plugins", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
    const result = reg.registerPluginLayers("plugin-b", [{ name: "custom", zOrder: 250 }]);
    expect(result.denied.length).toBe(1);
  });

  // --- z-order collision detection ---

  it("registerPluginLayers denies z-order conflicts with built-ins", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 200 }]);
    expect(result.registered.length).toBe(0);
    expect(result.denied.length).toBe(1);
    expect(result.denied[0]?.reason.includes("z-order 200")).toBe(true);
    expect(result.denied[0]?.reason.includes("main")).toBe(true);
  });

  it("registerPluginLayers denies z-order conflicts with other plugins", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerPluginLayers("plugin-a", [{ name: "custom-a", zOrder: 150 }]);
    const result = reg.registerPluginLayers("plugin-b", [{ name: "custom-b", zOrder: 150 }]);
    expect(result.registered.length).toBe(0);
    expect(result.denied.length).toBe(1);
    expect(result.denied[0]?.reason.includes("z-order 150")).toBe(true);
    expect(result.denied[0]?.reason.includes("custom-a")).toBe(true);
  });

  // --- getOrderedLayers sorting ---

  it("getOrderedLayers includes plugin layers sorted by zOrder", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
    const layers = reg.getOrderedLayers();
    expect(layers.length).toBe(8);
    expect(layers[2]?.name).toBe("custom");
  });

  // --- Cascade removal ---

  it("unregisterPluginLayers removes layers and cascades surfaces", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
    // Register surfaces from different plugins on the custom layer
    reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "custom" }));
    reg.registerSurface("plugin-b", makeSurface({ id: "s2", layer: "custom" }));
    // Also a surface on a built-in layer (should NOT be affected)
    reg.registerSurface("plugin-a", makeSurface({ id: "s3", layer: "floating" }));

    const result = reg.unregisterPluginLayers("plugin-a");
    expect(result.removedLayers).toEqual(["custom"]);
    expect(result.affectedSurfaceIds.length).toBe(2);
    expect(reg.getLayer("custom")).toBe(undefined);
    expect(reg.getAllSurfaces().length).toBe(1);
  });

  // --- Surface validation ---

  it("validateSurfaceContribution rejects non-existent layer", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.validateSurfaceContribution(makeSurface({ layer: "nonexistent" }));
    expect(result.valid).toBe(false);
  });

  it("validateSurfaceContribution rejects non-contributable layer", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.validateSurfaceContribution(makeSurface({ layer: "main" }));
    expect(result.valid).toBe(false);
  });

  it("validateSurfaceContribution rejects sessionLock on non-supporting layer", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.validateSurfaceContribution(makeSurface({ layer: "floating", sessionLock: true }));
    expect(result.valid).toBe(false);
  });

  it("validateSurfaceContribution accepts sessionLock on overlay", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.validateSurfaceContribution(makeSurface({ layer: "overlay", sessionLock: true }));
    expect(result.valid).toBe(true);
  });

  it("validateSurfaceContribution accepts valid surface", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
    expect(result.valid).toBe(true);
  });

  // --- Surface registration and unregistration ---

  it("registerSurface rejects invalid surfaces", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.registerSurface("plugin-a", makeSurface({ layer: "main" }));
    expect(result.success).toBe(false);
  });

  it("unregisterSurfaces removes only surfaces from specified plugin", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
    reg.registerSurface("plugin-b", makeSurface({ id: "s2", layer: "floating" }));
    const removed = reg.unregisterSurfaces("plugin-a");
    expect(removed).toEqual(["s1"]);
    expect(reg.getAllSurfaces().length).toBe(1);
  });

  it("getSurfacesForLayer returns matching surfaces", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
    reg.registerSurface("plugin-a", makeSurface({ id: "s2", layer: "notification" }));
    const surfaces = reg.getSurfacesForLayer("floating");
    expect(surfaces.length).toBe(1);
    expect(surfaces[0]?.surface.id).toBe("s1");
  });

  // --- Session lock check integration ---

  it("sessionLockCheck rejects surfaces during active lock", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.setSessionLockCheck((zOrder) => zOrder <= 600);
    // floating is z=300, should pass
    const r1 = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
    expect(r1.valid).toBe(true);

    // Now simulate lock blocking everything above z=0
    reg.setSessionLockCheck((_zOrder) => false);
    const r2 = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
    expect(r2.valid).toBe(false);
    expect(r2.reason?.includes("Session lock active")).toBe(true);
  });

  it("no sessionLockCheck set — surfaces pass as before", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    const result = reg.validateSurfaceContribution(makeSurface({ layer: "floating" }));
    expect(result.valid).toBe(true);
  });

  // --- onSurfacesRemoved callback ---

  it("onSurfacesRemoved fires on unregisterPluginLayers", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerPluginLayers("plugin-a", [{ name: "custom", zOrder: 150 }]);
    reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "custom" }));
    reg.registerSurface("plugin-b", makeSurface({ id: "s2", layer: "custom" }));

    const removedEntries: Array<{ surfaceId: string; pluginId: string }> = [];
    reg.setOnSurfacesRemoved((entries) => {
      removedEntries.push(...entries);
    });

    reg.unregisterPluginLayers("plugin-a");
    expect(removedEntries.length).toBe(2);
  });

  it("onSurfacesRemoved fires on unregisterSurfaces", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
    reg.registerSurface("plugin-a", makeSurface({ id: "s2", layer: "notification" }));

    const removedEntries: Array<{ surfaceId: string; pluginId: string }> = [];
    reg.setOnSurfacesRemoved((entries) => {
      removedEntries.push(...entries);
    });

    reg.unregisterSurfaces("plugin-a");
    expect(removedEntries.length).toBe(2);
    expect(removedEntries[0]?.pluginId).toBe("plugin-a");
  });

  it("no onSurfacesRemoved callback set — no error on unregister", () => {
    const reg = new LayerRegistry();
    reg.registerBuiltinLayers();
    reg.registerSurface("plugin-a", makeSurface({ id: "s1", layer: "floating" }));
    // Should not throw
    reg.unregisterSurfaces("plugin-a");
    expect(reg.getAllSurfaces().length).toBe(0);
  });
});
