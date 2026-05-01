import { describe, expect, it } from "vitest";
import { createChildSlotRegistry } from "../child-slot.js";

describe("ChildSlotRegistry", () => {
  it("returns empty array for unknown slot", () => {
    const registry = createChildSlotRegistry();
    expect(registry.getSlotRoutes("unknown")).toEqual([]);
  });

  it("resolveChildRoute returns undefined for empty slot", () => {
    const registry = createChildSlotRegistry();
    expect(registry.resolveChildRoute("slot-a", "route-1")).toBeUndefined();
  });

  it("contributes and resolves a single route", () => {
    const registry = createChildSlotRegistry();
    registry.contributeRoutes("slot-a", [{ id: "child-1", path: "/child-1" }]);

    expect(registry.resolveChildRoute("slot-a", "child-1")).toEqual({
      id: "child-1",
      path: "/child-1",
    });
  });

  it("multiple plugins contribute to same slot", () => {
    const registry = createChildSlotRegistry();
    registry.contributeRoutes("slot-a", [{ id: "child-1", path: "/c1" }]);
    registry.contributeRoutes("slot-a", [{ id: "child-2", path: "/c2" }]);

    expect(registry.getSlotRoutes("slot-a")).toHaveLength(2);
    expect(registry.resolveChildRoute("slot-a", "child-2")).toEqual({
      id: "child-2",
      path: "/c2",
    });
  });

  it("late contribution is visible", () => {
    const registry = createChildSlotRegistry();
    expect(registry.resolveChildRoute("slot-a", "late")).toBeUndefined();

    registry.contributeRoutes("slot-a", [{ id: "late", path: "/late" }]);
    expect(registry.resolveChildRoute("slot-a", "late")).toBeDefined();
  });

  it("dispose removes contributed routes", () => {
    const registry = createChildSlotRegistry();
    const dispose = registry.contributeRoutes("slot-a", [
      { id: "child-1", path: "/c1" },
      { id: "child-2", path: "/c2" },
    ]);

    expect(registry.getSlotRoutes("slot-a")).toHaveLength(2);

    dispose();

    expect(registry.getSlotRoutes("slot-a")).toEqual([]);
    expect(registry.resolveChildRoute("slot-a", "child-1")).toBeUndefined();
  });

  it("dispose only removes own contributions", () => {
    const registry = createChildSlotRegistry();
    registry.contributeRoutes("slot-a", [{ id: "from-plugin-a", path: "/a" }]);
    const dispose = registry.contributeRoutes("slot-a", [{ id: "from-plugin-b", path: "/b" }]);

    dispose();

    expect(registry.getSlotRoutes("slot-a")).toHaveLength(1);
    expect(registry.resolveChildRoute("slot-a", "from-plugin-a")).toBeDefined();
  });
});
