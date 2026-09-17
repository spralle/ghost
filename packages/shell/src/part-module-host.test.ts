// @vitest-environment happy-dom

import type { PluginServices } from "@ghost-shell/contracts";
import { createVanillaDomRenderer } from "@ghost-shell/plugin-system";
import { describe, expect, it, vi } from "vitest";
import { createRendererMountContext } from "./part-module-host.js";

describe("renderer mount context", () => {
  it("preserves services, registry, metadata, args, and asynchronous cleanup", async () => {
    const services: PluginServices = { getService: () => null, hasService: () => false };
    const registry = { subscribe: vi.fn() };
    const part = {
      id: "appearance",
      instanceId: "appearance-1",
      definitionId: "appearance.settings",
      title: "Appearance",
      component: "appearance-part",
      pluginId: "appearance-plugin",
      args: { section: "theme" },
    };
    const mountContext = createRendererMountContext(part, { services, registry });
    const cleanup = vi.fn();
    const mountPart = vi.fn(async () => ({ unmount: cleanup }));
    const renderer = createVanillaDomRenderer();

    const handle = renderer.mount({
      container: document.createElement("div"),
      mountContext,
      partId: part.definitionId,
      pluginId: part.pluginId,
      module: { mountPart },
    });
    await Promise.resolve();

    expect(mountContext.runtime.services).toBe(services);
    expect(mountContext.runtime.registry).toBe(registry);
    expect(mountContext.instanceId).toBe("appearance-1");
    expect(mountContext.args).toEqual({ section: "theme" });
    expect(mountPart).toHaveBeenCalledWith(expect.any(HTMLElement), mountContext);
    handle.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
