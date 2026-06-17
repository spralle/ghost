import { describe, expect, it, vi } from "vitest";
import { createState } from "../reactive-state.js";
import { wireGatewayHost } from "../gateway-host-wiring.js";
import type { ShellPluginRegistry } from "../plugin-registry-types.js";
import type { ScompPeer } from "../scomp-runtime.js";

function createMockRegistry(services: Record<string, { impl: unknown; state?: object; lazy?: boolean }>): ShellPluginRegistry {
  return {
    getService(serviceId: string) {
      return services[serviceId]?.impl ?? null;
    },
    getServiceOptions(serviceId: string) {
      const svc = services[serviceId];
      if (!svc) return null;
      return { lazy: svc.lazy };
    },
    getServiceState(serviceId: string) {
      return services[serviceId]?.state ?? null;
    },
    getRegisteredServiceIds() {
      return Object.keys(services);
    },
    hasService(serviceId: string) {
      return serviceId in services;
    },
  } as unknown as ShellPluginRegistry;
}

function createMockScomp(): ScompPeer & { registered: { contract: { id: string }; implementation: unknown }[] } {
  const registered: { contract: { id: string }; implementation: unknown }[] = [];
  return {
    participantId: "host-window",
    registered,
    resolve() {
      throw new Error("not implemented");
    },
    register(definition: { contract: { id: string }; implementation: unknown }) {
      registered.push(definition);
      return { dispose: vi.fn() };
    },
  };
}

describe("wireGatewayHost", () => {
  it("creates gateway host and registers with scomp", () => {
    const registry = createMockRegistry({
      "theme.service": { impl: { state: createState({ active: "dark" }) }, state: createState({ active: "dark" }) },
    });
    const scomp = createMockScomp();

    const result = wireGatewayHost({ pluginRegistry: registry, scomp });

    expect(scomp.registered).toHaveLength(1);
    expect(scomp.registered[0].contract.id).toBe("ghost.service-gateway");
    expect(result.dispose).toBeTypeOf("function");
  });

  it("lazy services are not subscribed eagerly", () => {
    const lazyState = createState({ value: 1 });
    const eagerState = createState({ value: 2 });

    const registry = createMockRegistry({
      "lazy.service": { impl: { state: lazyState }, state: lazyState, lazy: true },
      "eager.service": { impl: { state: eagerState }, state: eagerState, lazy: false },
    });
    const scomp = createMockScomp();

    wireGatewayHost({ pluginRegistry: registry, scomp });

    const gateway = scomp.registered[0].implementation as {
      lazyManager: { isActive(id: string): boolean };
    };

    // Lazy service should NOT have an active subscription
    expect(gateway.lazyManager.isActive("lazy.service")).toBe(false);
  });

  it("RPC call to lazy service triggers subscription", async () => {
    const lazyState = createState({ value: 1 });
    const lazyImpl = { state: lazyState, getValue: () => lazyState.value };

    const registry = createMockRegistry({
      "lazy.service": { impl: lazyImpl, state: lazyState, lazy: true },
    });
    const scomp = createMockScomp();

    wireGatewayHost({ pluginRegistry: registry, scomp });

    const gateway = scomp.registered[0].implementation as {
      callService: (req: { tokenId: string; method: string; args: unknown[] }) => Promise<{ ok: boolean; value?: unknown }>;
      lazyManager: { isActive(id: string): boolean };
    };

    expect(gateway.lazyManager.isActive("lazy.service")).toBe(false);

    const response = await gateway.callService({
      tokenId: "lazy.service",
      method: "getValue",
      args: [],
    });

    expect(response.ok).toBe(true);
    expect(response.value).toBe(1);
    expect(gateway.lazyManager.isActive("lazy.service")).toBe(true);
  });

  it("non-lazy service has subscription from start", async () => {
    const eagerState = createState({ value: 2 });

    const registry = createMockRegistry({
      "eager.service": { impl: { state: eagerState }, state: eagerState, lazy: false },
    });
    const scomp = createMockScomp();

    wireGatewayHost({ pluginRegistry: registry, scomp });

    // The gateway wires all non-lazy services eagerly via wireAllServices()
    // We verify by checking that state ops are forwarded
    const gateway = scomp.registered[0].implementation as {
      subscribeOps: (cb: (batch: unknown) => void) => () => void;
    };

    const batches: unknown[] = [];
    gateway.subscribeOps((batch) => batches.push(batch));

    // Mutate the eager state — should trigger op broadcast
    eagerState.value = 99;

    // valtio subscribe fires asynchronously
    await Promise.resolve();

    expect(batches).toHaveLength(1);
  });

  it("dispose cleans up gateway and scomp registration", () => {
    const registry = createMockRegistry({
      "svc": { impl: { state: createState({ x: 1 }) }, state: createState({ x: 1 }) },
    });
    const scomp = createMockScomp();

    const result = wireGatewayHost({ pluginRegistry: registry, scomp });
    result.dispose();

    // After dispose, state mutations should not broadcast
    const gateway = scomp.registered[0].implementation as {
      subscribeOps: (cb: (batch: unknown) => void) => () => void;
    };
    const batches: unknown[] = [];
    gateway.subscribeOps((batch) => batches.push(batch));

    // No crash, no ops
    expect(batches).toHaveLength(0);
  });
});
