import { describe, expect, it } from "vitest";
import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts/layer";
import { AnchorEdge } from "@ghost-shell/contracts/layer";
import { computeAnchorStyles, computeExclusiveZones, getAnchorKey } from "../anchor-positioning.js";

function makeSurface(overrides: Partial<PluginLayerSurfaceContribution> = {}): PluginLayerSurfaceContribution {
  return {
    id: "test-surface",
    component: "./TestComponent",
    layer: "floating",
    anchor: AnchorEdge.None,
    ...overrides,
  };
}

describe("anchor-positioning", () => {
  // ---------------------------------------------------------------------------
  // computeAnchorStyles – all 16 anchor combinations
  // ---------------------------------------------------------------------------

  it("anchor 0 (None) → centered", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: 0 }));
    expect(s.position).toBe("absolute");
    expect(s.top).toBe("50%");
    expect(s.left).toBe("50%");
    expect(s.transform).toBe("translate(-50%,-50%)");
    expect(s.width).toBe("auto");
    expect(s.height).toBe("auto");
  });

  it("anchor 1 (Top) → top edge, fill width", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top }));
    expect(s.position).toBe("absolute");
    expect(s.top).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.height).toBe("auto");
    expect(s.width).toBe(undefined);
  });

  it("anchor 2 (Bottom) → bottom edge, fill width", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom }));
    expect(s.bottom).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.height).toBe("auto");
  });

  it("anchor 3 (Top+Bottom) → fill height, centered horiz", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom }));
    expect(s.top).toBe("0px");
    expect(s.bottom).toBe("0px");
    expect(s.left).toBe("50%");
    expect(s.transform).toBe("translateX(-50%)");
    expect(s.width).toBe("auto");
    expect(s.height).toBe(undefined);
  });

  it("anchor 4 (Left) → left edge, fill height", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Left }));
    expect(s.left).toBe("0px");
    expect(s.top).toBe("0px");
    expect(s.bottom).toBe("0px");
    expect(s.width).toBe("auto");
  });

  it("anchor 5 (Top+Left) → top-left corner", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left }));
    expect(s.top).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.width).toBe("auto");
    expect(s.height).toBe("auto");
  });

  it("anchor 6 (Bottom+Left) → bottom-left corner", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom | AnchorEdge.Left }));
    expect(s.bottom).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.width).toBe("auto");
    expect(s.height).toBe("auto");
  });

  it("anchor 7 (Top+Bottom+Left) → left panel, fill height", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left }));
    expect(s.top).toBe("0px");
    expect(s.bottom).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.width).toBe("auto");
    expect(s.height).toBe(undefined);
  });

  it("anchor 8 (Right) → right edge, fill height", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Right }));
    expect(s.right).toBe("0px");
    expect(s.top).toBe("0px");
    expect(s.bottom).toBe("0px");
    expect(s.width).toBe("auto");
  });

  it("anchor 9 (Top+Right) → top-right corner", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Right }));
    expect(s.top).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.width).toBe("auto");
    expect(s.height).toBe("auto");
  });

  it("anchor 10 (Bottom+Right) → bottom-right corner", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom | AnchorEdge.Right }));
    expect(s.bottom).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.width).toBe("auto");
    expect(s.height).toBe("auto");
  });

  it("anchor 11 (Top+Bottom+Right) → right panel, fill height", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Right }));
    expect(s.top).toBe("0px");
    expect(s.bottom).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.width).toBe("auto");
  });

  it("anchor 12 (Left+Right) → fill width, centered vert", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Left | AnchorEdge.Right }));
    expect(s.left).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.top).toBe("50%");
    expect(s.transform).toBe("translateY(-50%)");
    expect(s.height).toBe("auto");
  });

  it("anchor 13 (Top+Left+Right) → top panel, fill width", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left | AnchorEdge.Right }));
    expect(s.top).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.height).toBe("auto");
  });

  it("anchor 14 (Bottom+Left+Right) → bottom panel, fill width", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right }));
    expect(s.bottom).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.height).toBe("auto");
  });

  it("anchor 15 (all edges) → fill entire layer", () => {
    const s = computeAnchorStyles(
      makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right }),
    );
    expect(s.top).toBe("0px");
    expect(s.right).toBe("0px");
    expect(s.bottom).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.width).toBe(undefined);
    expect(s.height).toBe(undefined);
  });

  // ---------------------------------------------------------------------------
  // Margin application
  // ---------------------------------------------------------------------------

  it("margins are applied correctly", () => {
    const s = computeAnchorStyles(
      makeSurface({
        anchor: AnchorEdge.Top | AnchorEdge.Left,
        margin: { top: 10, left: 20, right: 5, bottom: 15 },
      }),
    );
    expect(s.top).toBe("10px");
    expect(s.left).toBe("20px");
  });

  it("margins on fill-width anchor", () => {
    const s = computeAnchorStyles(
      makeSurface({
        anchor: AnchorEdge.Top,
        margin: { top: 8, left: 16, right: 16 },
      }),
    );
    expect(s.top).toBe("8px");
    expect(s.left).toBe("16px");
    expect(s.right).toBe("16px");
  });

  // ---------------------------------------------------------------------------
  // Size as number vs string
  // ---------------------------------------------------------------------------

  it("size as number appends px", () => {
    const s = computeAnchorStyles(
      makeSurface({
        anchor: AnchorEdge.Top | AnchorEdge.Left,
        size: { width: 300, height: 200 },
      }),
    );
    expect(s.width).toBe("300px");
    expect(s.height).toBe("200px");
  });

  it("size as string used as-is", () => {
    const s = computeAnchorStyles(
      makeSurface({
        anchor: AnchorEdge.Top | AnchorEdge.Left,
        size: { width: "50vw", height: "100%" },
      }),
    );
    expect(s.width).toBe("50vw");
    expect(s.height).toBe("100%");
  });

  // ---------------------------------------------------------------------------
  // Default margins and sizes
  // ---------------------------------------------------------------------------

  it("defaults: no margin → 0px, no size → auto", () => {
    const s = computeAnchorStyles(makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left }));
    expect(s.top).toBe("0px");
    expect(s.left).toBe("0px");
    expect(s.width).toBe("auto");
    expect(s.height).toBe("auto");
  });

  // ---------------------------------------------------------------------------
  // computeExclusiveZones
  // ---------------------------------------------------------------------------

  it("exclusive zone: single top surface", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 40 }), pluginId: "p1" },
    ]);
    expect(zones).toEqual({ top: 40, right: 0, bottom: 0, left: 0 });
  });

  it("exclusive zone: multiple surfaces same edge → max wins", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 40 }), pluginId: "p1" },
      { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 60 }), pluginId: "p2" },
    ]);
    expect(zones.top).toBe(60);
  });

  it("exclusive zone: multiple edges", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 30 }), pluginId: "p1" },
      { surface: makeSurface({ anchor: AnchorEdge.Left, exclusiveZone: 50 }), pluginId: "p2" },
      { surface: makeSurface({ anchor: AnchorEdge.Bottom, exclusiveZone: 20 }), pluginId: "p3" },
    ]);
    expect(zones).toEqual({ top: 30, right: 0, bottom: 20, left: 50 });
  });

  it("exclusive zone: exclusiveZone=0 excluded", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: 0 }), pluginId: "p1" },
    ]);
    expect(zones).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("exclusive zone: exclusiveZone=-1 excluded", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top, exclusiveZone: -1 }), pluginId: "p1" },
    ]);
    expect(zones).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("exclusive zone: ambiguous anchor (top+bottom) → no reservation", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Bottom, exclusiveZone: 50 }), pluginId: "p1" },
    ]);
    expect(zones).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("exclusive zone: top+left anchor → top edge reservation", () => {
    const zones = computeExclusiveZones([
      { surface: makeSurface({ anchor: AnchorEdge.Top | AnchorEdge.Left, exclusiveZone: 30 }), pluginId: "p1" },
    ]);
    // Top without bottom → top edge. Left without right → also left edge.
    // Implementation: first matching condition wins (top takes priority).
    expect(zones.top).toBe(30);
  });

  // ---------------------------------------------------------------------------
  // getAnchorKey
  // ---------------------------------------------------------------------------

  it("anchor key: 0 → center", () => {
    expect(getAnchorKey(0)).toBe("center");
  });

  it("anchor key: Top → top", () => {
    expect(getAnchorKey(AnchorEdge.Top)).toBe("top");
  });

  it("anchor key: Top+Right → top-right", () => {
    expect(getAnchorKey(AnchorEdge.Top | AnchorEdge.Right)).toBe("top-right");
  });

  it("anchor key: Top+Left → top-left", () => {
    expect(getAnchorKey(AnchorEdge.Top | AnchorEdge.Left)).toBe("top-left");
  });

  it("anchor key: all edges → top-bottom-left-right", () => {
    expect(
      getAnchorKey(AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right),
    ).toBe("top-bottom-left-right");
  });

  it("anchor key: Bottom+Left+Right → bottom-left-right", () => {
    expect(
      getAnchorKey(AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right),
    ).toBe("bottom-left-right");
  });
});
