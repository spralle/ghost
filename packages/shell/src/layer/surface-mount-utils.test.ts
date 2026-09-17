// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { isMountCleanup, resolveSurfaceMount } from "./surface-mount-utils.js";

const surface = { id: "notice", component: "notice-component", layer: "notification", anchor: 1 };

describe("surface mount utilities", () => {
  it("resolves direct federation mounts with named-export precedence", () => {
    const named = vi.fn();
    const collected = vi.fn();
    const resolved = resolveSurfaceMount({ mountSurface: named, surfaces: { "notice-component": collected } }, surface);
    const target = document.createElement("div");
    const context = { surfaceId: "plugin--notice" };

    resolved?.(target, context);

    expect(named).toHaveBeenCalledWith(target, context);
    expect(collected).not.toHaveBeenCalled();
  });

  it("rejects absent and non-callable exports", () => {
    expect(resolveSurfaceMount({}, surface)).toBeNull();
    expect(resolveSurfaceMount({ mountSurface: "invalid" }, surface)).toBeNull();
  });

  it("accepts supported cleanup boundaries and rejects other results", () => {
    expect(isMountCleanup(undefined)).toBe(true);
    expect(isMountCleanup(() => {})).toBe(true);
    expect(isMountCleanup({ dispose() {} })).toBe(true);
    expect(isMountCleanup({ unmount() {} })).toBe(true);
    expect(isMountCleanup({ dispose: "invalid" })).toBe(false);
    expect(isMountCleanup(null)).toBe(false);
  });
});
