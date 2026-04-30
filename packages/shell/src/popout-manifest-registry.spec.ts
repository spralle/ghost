import { describe, expect, it } from "vitest";
import type { PopoutManifest } from "./popout-manifest.js";
import { createPopoutManifestRegistry } from "./popout-manifest-registry.js";

const testManifest: PopoutManifest = {
  parts: [{ partId: "test-part", pluginId: "test-plugin" }],
  plugins: [{ pluginId: "test-plugin", remoteEntry: "http://localhost:4171/remoteEntry.js" }],
  availableServices: ["theme", "action"],
};

describe("createPopoutManifestRegistry", () => {
  it("stores and claims a manifest", () => {
    const registry = createPopoutManifestRegistry();
    registry.set("window-1", testManifest);
    expect(registry.has("window-1")).toBe(true);
    expect(registry.size).toBe(1);

    const claimed = registry.claim("window-1");
    expect(claimed).toEqual(testManifest);
    expect(registry.has("window-1")).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("returns null for unknown window", () => {
    const registry = createPopoutManifestRegistry();
    expect(registry.claim("unknown")).toBeNull();
  });

  it("removes without claiming", () => {
    const registry = createPopoutManifestRegistry();
    registry.set("window-1", testManifest);
    registry.remove("window-1");
    expect(registry.has("window-1")).toBe(false);
  });
});
