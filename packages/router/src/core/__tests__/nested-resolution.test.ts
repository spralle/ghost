import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createChildSlotRegistry } from "../child-slot.js";
import { resolveNestedRoute } from "../nested-resolution.js";
import type { ParentRouteEntry } from "../nested-resolution.js";

const parentRoutes: ParentRouteEntry[] = [
  {
    route: { id: "dashboard", schema: z.object({}) },
    childSlot: "dashboard-slot",
  },
  {
    route: { id: "settings", schema: z.object({}) },
    // no childSlot
  },
];

describe("resolveNestedRoute", () => {
  it("returns undefined for unknown parent", () => {
    const registry = createChildSlotRegistry();
    const result = resolveNestedRoute({ parentRouteId: "nope" }, parentRoutes, registry);
    expect(result).toBeUndefined();
  });

  it("resolves parent without child when no childRouteId given", () => {
    const registry = createChildSlotRegistry();
    const result = resolveNestedRoute({ parentRouteId: "dashboard" }, parentRoutes, registry);
    expect(result).toEqual({ parent: parentRoutes[0]!.route, child: null });
  });

  it("resolves parent and child when slot has contribution", () => {
    const registry = createChildSlotRegistry();
    registry.contributeRoutes("dashboard-slot", [{ id: "widget", path: "/widget" }]);

    const result = resolveNestedRoute(
      { parentRouteId: "dashboard", childRouteId: "widget" },
      parentRoutes,
      registry,
    );
    expect(result?.child).toEqual({ id: "widget", path: "/widget" });
  });

  it("returns null child when parent has no childSlot", () => {
    const registry = createChildSlotRegistry();
    const result = resolveNestedRoute(
      { parentRouteId: "settings", childRouteId: "anything" },
      parentRoutes,
      registry,
    );
    expect(result?.child).toBeNull();
  });
});
