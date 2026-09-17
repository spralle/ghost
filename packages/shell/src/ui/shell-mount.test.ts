// @vitest-environment happy-dom

import { LayerRegistry } from "@ghost-shell/layer";
import { describe, expect, it, vi } from "vitest";
import { getLayerRegistry, mountMainWindow, mountPopout } from "./shell-mount.js";

function commonMountDeps() {
  return {
    renderParts: vi.fn(),
    updateWindowReadOnlyState: vi.fn(),
    setupResize: () => vi.fn(),
    publishRestoreRequestOnUnload: vi.fn(),
  };
}

describe("shell mounts", () => {
  it("wires the authoritative layer registry for the main window", () => {
    const root = document.createElement("div");
    const layerRegistry = new LayerRegistry();
    layerRegistry.registerBuiltinLayers();
    const renderLayerSurfaces = vi.fn();

    mountMainWindow(root, { ...commonMountDeps(), layerRegistry, renderLayerSurfaces });

    expect(renderLayerSurfaces).toHaveBeenCalledOnce();
    expect(getLayerRegistry()).toBe(layerRegistry);
    expect(root.querySelector("#layer-host")).not.toBeNull();
  });

  it("mounts a popout without layer-only dependencies", () => {
    const root = document.createElement("div");
    const deps = commonMountDeps();
    const runtime = { popoutTabId: null, hostWindowId: null };

    const dispose = mountPopout(root, runtime, deps);

    expect(deps.renderParts).toHaveBeenCalledOnce();
    expect(root.querySelector("#popout-slot")).not.toBeNull();
    dispose();
  });
});
