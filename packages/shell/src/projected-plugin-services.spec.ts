import { createServiceToken } from "@ghost-shell/contracts";
import { describe, expect, it, vi } from "vitest";
import { createProjectedPluginServices, type ServiceGatewayTransport } from "./projected-plugin-services.js";
import type { StateOpBatch } from "./service-gateway-contract.js";

interface MockThemeService {
  state: { activeThemeId: string | null };
  setTheme(id: string): Promise<boolean>;
}

const ThemeToken = createServiceToken<MockThemeService>("ghost.theme");

function createMockTransport(): ServiceGatewayTransport & {
  opCallbacks: Set<(batch: StateOpBatch) => void>;
  emitOps(batch: StateOpBatch): void;
} {
  const opCallbacks = new Set<(batch: StateOpBatch) => void>();
  return {
    opCallbacks,
    callService: vi.fn().mockResolvedValue({ ok: true, value: true }),
    getStateSnapshot: vi.fn().mockResolvedValue({
      tokenId: "ghost.theme",
      snapshot: { activeThemeId: "tokyo-night" },
    }),
    subscribeOps(callback) {
      opCallbacks.add(callback);
      return () => {
        opCallbacks.delete(callback);
      };
    },
    emitOps(batch) {
      for (const cb of opCallbacks) cb(batch);
    },
  };
}

describe("ProjectedPluginServices", () => {
  it("getService returns a proxy for any token", () => {
    const transport = createMockTransport();
    const services = createProjectedPluginServices(transport);
    const theme = services.getService(ThemeToken);
    expect(theme).not.toBeNull();
  });

  it("method calls forward to host via transport", async () => {
    const transport = createMockTransport();
    const services = createProjectedPluginServices(transport);
    const theme = services.getService(ThemeToken)!;

    const result = await theme.setTheme("ocean-dark");

    expect(transport.callService).toHaveBeenCalledWith({
      tokenId: "ghost.theme",
      method: "setTheme",
      args: ["ocean-dark"],
    });
    expect(result).toBe(true);
  });

  it("state reads from local replica after snapshot", async () => {
    const transport = createMockTransport();
    const services = createProjectedPluginServices(transport);
    const theme = services.getService(ThemeToken)!;

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(theme.state).toBeDefined();
    expect(theme.state.activeThemeId).toBe("tokyo-night");
  });

  it("applies ops to local replica", async () => {
    const transport = createMockTransport();
    const services = createProjectedPluginServices(transport);
    services.getService(ThemeToken);

    await new Promise((resolve) => setTimeout(resolve, 10));

    transport.emitOps({
      tokenId: "ghost.theme",
      ops: [{ op: "set", path: ["activeThemeId"], value: "ocean-dark" }],
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const theme = services.getService(ThemeToken)!;
    expect(theme.state.activeThemeId).toBe("ocean-dark");
  });

  it("dispose cleans up", () => {
    const transport = createMockTransport();
    const services = createProjectedPluginServices(transport);
    services.getService(ThemeToken);
    services.dispose();
    expect(transport.opCallbacks.size).toBe(0);
  });
});
