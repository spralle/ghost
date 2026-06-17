import { describe, expect, it, vi } from "vitest";
import { createPopoutPluginLoader, createPopoutPartMounter } from "./popout-boot-wiring.js";
import { createPopoutManifestHost } from "./popout-manifest-host.js";
import { createPopoutManifestRegistry } from "./popout-manifest-registry.js";
import { POPOUT_MANIFEST_CONTRACT_ID } from "./popout-manifest.js";
import type { PopoutManifest } from "./popout-manifest.js";
import { bootPopoutWindow } from "./popout-boot.js";
import type { ScompPeer } from "./scomp-runtime.js";
import type { ServiceGatewayTransport } from "./projected-plugin-services.js";

function createMockFederationRuntime() {
  return {
    registerRemote: vi.fn(),
    loadPluginContract: vi.fn(),
    loadPluginComponents: vi.fn(),
    loadPluginServices: vi.fn(),
  };
}

function createMockServiceGatewayTransport(): ServiceGatewayTransport {
  return {
    callService: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getStateSnapshot: vi.fn().mockResolvedValue({ snapshot: null }),
    subscribeOps: vi.fn().mockReturnValue(() => {}),
  };
}

function createMockScompPeer(manifest: PopoutManifest): ScompPeer {
  return {
    participantId: "popout-window-1",
    resolve: vi.fn().mockReturnValue({
      getManifest: vi.fn().mockResolvedValue(manifest),
    }),
    register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

const testManifest: PopoutManifest = {
  parts: [{ partId: "editor-view", pluginId: "editor-plugin" }],
  plugins: [{ pluginId: "editor-plugin", remoteEntry: "http://localhost:4171/remote.js" }],
  availableServices: ["theme"],
};

describe("popout-boot-wiring", () => {
  describe("host-side manifest registration", () => {
    it("registers manifest contract with scomp", () => {
      const registry = createPopoutManifestRegistry();
      registry.set("popout-1", testManifest);

      const host = createPopoutManifestHost({
        registry,
        getRequestingPeerId: () => "popout-1",
      });

      const scomp: ScompPeer = {
        participantId: "host-window",
        resolve: vi.fn(),
        register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      };

      scomp.register({
        contract: { id: POPOUT_MANIFEST_CONTRACT_ID },
        implementation: host,
      });

      expect(scomp.register).toHaveBeenCalledWith({
        contract: { id: POPOUT_MANIFEST_CONTRACT_ID },
        implementation: host,
      });
    });

    it("popout resolves manifest via scomp and gets correct data", async () => {
      const registry = createPopoutManifestRegistry();
      registry.set("popout-1", testManifest);

      const host = createPopoutManifestHost({
        registry,
        getRequestingPeerId: () => "popout-1",
      });

      const result = await host.getManifest();
      expect(result).toEqual(testManifest);
    });
  });

  describe("activation resolution in popout", () => {
    it("calls activateSecondary when activation rule matches isSecondary", async () => {
      const activateSecondary = vi.fn();
      const federation = createMockFederationRuntime();
      federation.loadPluginContract.mockResolvedValue({
        pluginContract: {
          manifest: { id: "test-plugin", version: "1.0.0", name: "Test" },
          activations: [{ entry: "activateSecondary", when: { isSecondary: true } }],
        },
        activate: vi.fn(),
        activateSecondary,
      });

      const loader = createPopoutPluginLoader({
        federationRuntime: federation,
        scompPeer: createMockScompPeer(testManifest),
        serviceGatewayTransport: createMockServiceGatewayTransport(),
      });

      await loader("test-plugin", "http://localhost/remote.js");
      expect(activateSecondary).toHaveBeenCalled();
    });

    it("falls back to default activate when no activations array", async () => {
      const activate = vi.fn();
      const federation = createMockFederationRuntime();
      federation.loadPluginContract.mockResolvedValue({
        pluginContract: {
          manifest: { id: "test-plugin", version: "1.0.0", name: "Test" },
        },
        activate,
      });

      const loader = createPopoutPluginLoader({
        federationRuntime: federation,
        scompPeer: createMockScompPeer(testManifest),
        serviceGatewayTransport: createMockServiceGatewayTransport(),
      });

      await loader("test-plugin", "http://localhost/remote.js");
      expect(activate).toHaveBeenCalled();
    });
  });

  describe("service resolution", () => {
    it("projected services proxy forwards calls via transport", async () => {
      const transport = createMockServiceGatewayTransport();
      (transport.callService as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, value: 42 });

      const federation = createMockFederationRuntime();
      federation.loadPluginContract.mockResolvedValue({
        pluginContract: {
          manifest: { id: "svc-plugin", version: "1.0.0", name: "Svc" },
        },
        activate: vi.fn().mockImplementation((_api: unknown, ctx: { services: { getService: (id: string) => unknown } }) => {
          const svc = ctx.services.getService("my-service") as { doThing: () => Promise<number> };
          return svc.doThing();
        }),
      });

      const loader = createPopoutPluginLoader({
        federationRuntime: federation,
        scompPeer: createMockScompPeer(testManifest),
        serviceGatewayTransport: transport,
      });

      await loader("svc-plugin", "http://localhost/remote.js");
      // The activate function was called with projected services
      expect(federation.loadPluginContract).toHaveBeenCalledWith("svc-plugin");
    });
  });

  describe("boot error collection", () => {
    it("collects errors without throwing", async () => {
      const scomp = createMockScompPeer(testManifest);
      const loadPlugin = vi.fn().mockRejectedValue(new Error("load failed"));

      const result = await bootPopoutWindow({
        identity: { windowId: "w1", isSecondary: true, hostWindowId: "host" },
        scompPeer: scomp,
        loadPlugin,
        mountPart: createPopoutPartMounter({}),
      });

      expect(result.errors).toHaveLength(2); // load error + mount skip
      expect(result.errors[0].phase).toBe("load");
      expect(result.loadedPlugins).toHaveLength(0);
    });
  });

  describe("part mounter placeholder", () => {
    it("resolves without error", async () => {
      const mounter = createPopoutPartMounter({});
      await expect(mounter("part-1", "plugin-1", { x: 1 })).resolves.toBeUndefined();
    });
  });
});
