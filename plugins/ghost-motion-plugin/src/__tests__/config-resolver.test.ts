import { describe, expect, it } from "vitest";
import { DEFAULT_MOTION_CONFIG } from "../config-defaults.js";
import { resolveEntry } from "../config-resolver.js";
import type { GhostMotionConfig } from "../config-types.js";

describe("resolveEntry", () => {
  it("resolves a root node with explicit overrides", () => {
    const result = resolveEntry("windows", DEFAULT_MOTION_CONFIG);
    expect(result.enabled).toBe(true);
    expect(result.speed).toBe(4);
    expect(result.curve).toBe("snappy");
    expect(result.style).toBe("popin");
    expect(result.styleParam).toBe(80);
  });

  it("resolves a child node inheriting from parent", () => {
    const result = resolveEntry("windowsIn", DEFAULT_MOTION_CONFIG);
    // windowsIn has no override, inherits from windows
    expect(result.speed).toBe(4);
    expect(result.curve).toBe("snappy");
    expect(result.style).toBe("popin");
    expect(result.styleParam).toBe(80);
  });

  it("child override wins over parent", () => {
    const result = resolveEntry("windowsOut", DEFAULT_MOTION_CONFIG);
    // windowsOut overrides speed to 3, rest from windows
    expect(result.speed).toBe(3);
    expect(result.curve).toBe("snappy");
    expect(result.style).toBe("popin");
  });

  it("disabled parent disables child unless child re-enables", () => {
    const config: GhostMotionConfig = {
      ...DEFAULT_MOTION_CONFIG,
      animations: {
        ...DEFAULT_MOTION_CONFIG.animations,
        windows: { enabled: false },
      },
    };
    const result = resolveEntry("windowsIn", config);
    expect(result.enabled).toBe(false);
  });

  it("child can re-enable when parent is disabled", () => {
    const config: GhostMotionConfig = {
      ...DEFAULT_MOTION_CONFIG,
      animations: {
        ...DEFAULT_MOTION_CONFIG.animations,
        windows: { enabled: false },
        windowsIn: { enabled: true },
      },
    };
    const result = resolveEntry("windowsIn", config);
    expect(result.enabled).toBe(true);
  });

  it("missing fields fall back to GLOBAL_DEFAULT", () => {
    const config: GhostMotionConfig = {
      enabled: true,
      curves: [],
      animations: {},
    };
    const result = resolveEntry("windows", config);
    expect(result.enabled).toBe(true);
    expect(result.speed).toBe(5);
    expect(result.curve).toBe("default");
    expect(result.style).toBe("");
    expect(result.styleParam).toBe(0);
  });

  it("deep chain: fadeLayersIn → fadeDim → fade", () => {
    const result = resolveEntry("fadeLayersIn", DEFAULT_MOTION_CONFIG);
    // fade: speed=3, curve=smooth; fadeDim: speed=5; fadeLayersIn: no override
    expect(result.speed).toBe(5);
    expect(result.curve).toBe("smooth");
    expect(result.enabled).toBe(true);
  });
});
