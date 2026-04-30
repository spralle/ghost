import { describe, expect, it, vi } from "vitest";

import type { PopoutManifest } from "./popout-manifest.js";
import { bootPopoutWindow, type PopoutBootContext } from "./popout-boot.js";

const testManifest: PopoutManifest = {
  parts: [{ partId: "vessel-view", pluginId: "vessel-plugin" }],
  plugins: [{ pluginId: "vessel-plugin", remoteEntry: "http://localhost:4171/remote.js" }],
  availableServices: ["theme", "action"],
};

function createMockContext(manifest: PopoutManifest = testManifest): PopoutBootContext {
  return {
    identity: { windowId: "test-window", isSecondary: true, hostWindowId: "host-window" },
    scompPeer: {
      participantId: "test-window",
      resolve: vi.fn().mockReturnValue({
        getManifest: vi.fn().mockResolvedValue(manifest),
      }),
      register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    },
    loadPlugin: vi.fn().mockResolvedValue(undefined),
    mountPart: vi.fn().mockResolvedValue(undefined),
  };
}

describe("bootPopoutWindow", () => {
  it("completes full boot sequence", async () => {
    const ctx = createMockContext();
    const result = await bootPopoutWindow(ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.loadedPlugins).toEqual(["vessel-plugin"]);
    expect(result.mountedParts).toEqual(["vessel-view"]);
    expect(ctx.loadPlugin).toHaveBeenCalledWith("vessel-plugin", "http://localhost:4171/remote.js");
    expect(ctx.mountPart).toHaveBeenCalledWith("vessel-view", "vessel-plugin", undefined);
  });

  it("reports handshake failure gracefully", async () => {
    const ctx = createMockContext();
    ctx.scompPeer.resolve = vi.fn().mockReturnValue({
      getManifest: vi.fn().mockRejectedValue(new Error("connection lost")),
    });

    const result = await bootPopoutWindow(ctx);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].phase).toBe("handshake");
  });

  it("skips mount when plugin failed to load", async () => {
    const ctx = createMockContext();
    (ctx.loadPlugin as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));

    const result = await bootPopoutWindow(ctx);
    expect(result.loadedPlugins).toHaveLength(0);
    expect(result.mountedParts).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("passes part state to mountPart", async () => {
    const manifest: PopoutManifest = {
      parts: [{ partId: "p1", pluginId: "plug1", state: { scroll: 100 } }],
      plugins: [{ pluginId: "plug1", remoteEntry: "http://x/r.js" }],
      availableServices: [],
    };
    const ctx = createMockContext(manifest);
    await bootPopoutWindow(ctx);
    expect(ctx.mountPart).toHaveBeenCalledWith("p1", "plug1", { scroll: 100 });
  });
});
