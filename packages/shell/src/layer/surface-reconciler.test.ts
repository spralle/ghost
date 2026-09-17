// @vitest-environment happy-dom

import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { describe, expect, it, vi } from "vitest";
import { finishSurfaceMount, type SurfaceMountCompletionContext } from "./surface-reconciler.js";

const surface: PluginLayerSurfaceContribution = {
  id: "notice",
  component: "notice-component",
  layer: "notification",
  anchor: 1,
};

function createContext(generation: number) {
  const context: SurfaceMountCompletionContext = {
    generation,
    mounted: new Map(),
    maybeActivateSurfaceBehaviors: vi.fn(),
    onSurfaceMounted: vi.fn(),
    onSurfaceEntering: vi.fn(),
  };
  return context;
}

describe("finishSurfaceMount", () => {
  it("cleans up stale asynchronous mounts without publishing lifecycle events", () => {
    const context = createContext(2);
    const cleanup = vi.fn();

    finishSurfaceMount(context, document.createElement("div"), "plugin", surface, "plugin--notice", "key", 1, cleanup);

    expect(cleanup).toHaveBeenCalledOnce();
    expect(context.mounted.size).toBe(0);
    expect(context.onSurfaceMounted).not.toHaveBeenCalled();
  });

  it("records current mounts and publishes lifecycle events", () => {
    const context = createContext(1);
    const target = document.createElement("div");

    finishSurfaceMount(context, target, "plugin", surface, "plugin--notice", "key", 1, null);

    expect(context.mounted.get("plugin--notice")?.element).toBe(target);
    expect(context.maybeActivateSurfaceBehaviors).toHaveBeenCalledOnce();
    expect(context.onSurfaceMounted).toHaveBeenCalledWith("plugin--notice", "plugin");
    expect(context.onSurfaceEntering).toHaveBeenCalledWith(target, "plugin--notice", "plugin");
  });
});
