import { describe, expect, it, vi } from "vitest";
import { wirePopoutManifestContract } from "./popout-manifest-wiring.js";
import type { PopoutManifest } from "./popout-manifest.js";
import { POPOUT_MANIFEST_TOKEN } from "./popout-manifest.js";
import type { ScompPeer } from "./scomp-runtime.js";

const testManifest: PopoutManifest = {
  parts: [{ partId: "chart-view", pluginId: "chart-plugin" }],
  plugins: [{ pluginId: "chart-plugin", remoteEntry: "http://localhost:4171/remote.js" }],
  availableServices: ["theme"],
};

function createMockScompPeer(): ScompPeer & { registeredImpl: unknown } {
  let registeredImpl: unknown = null;
  return {
    participantId: "host-window",
    registeredImpl: null,
    resolve: vi.fn((token) => {
      return registeredImpl;
    }),
    register: vi.fn((def) => {
      registeredImpl = def.implementation;
      // biome-ignore lint/suspicious/noAssignInExpressions: test helper
      return { dispose: vi.fn(() => (registeredImpl = null)) };
    }),
  };
}

describe("wirePopoutManifestContract", () => {
  it("registers host and allows manifest resolution", async () => {
    const peer = createMockScompPeer();
    let requestingPeerId = "popout-1";

    const { registry } = wirePopoutManifestContract(peer, () => requestingPeerId);

    // Host sets manifest before popout connects
    registry.set("popout-1", testManifest);

    // Verify registration happened with correct token
    expect(peer.register).toHaveBeenCalledWith({
      contract: POPOUT_MANIFEST_TOKEN,
      implementation: expect.objectContaining({ getManifest: expect.any(Function) }),
    });

    // Simulate popout resolving the contract
    const registeredDef = (peer.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const host = registeredDef.implementation;
    const manifest = await host.getManifest();

    expect(manifest).toEqual(testManifest);
  });

  it("throws clear error when no manifest is registered", async () => {
    const peer = createMockScompPeer();
    wirePopoutManifestContract(peer, () => "unknown-window");

    const registeredDef = (peer.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const host = registeredDef.implementation;

    await expect(host.getManifest()).rejects.toThrow(/No manifest registered for window "unknown-window"/);
  });

  it("claimed manifest is removed from registry", async () => {
    const peer = createMockScompPeer();
    const { registry } = wirePopoutManifestContract(peer, () => "win-1");

    registry.set("win-1", testManifest);
    expect(registry.has("win-1")).toBe(true);

    const registeredDef = (peer.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const host = registeredDef.implementation;
    await host.getManifest();

    expect(registry.has("win-1")).toBe(false);
  });

  it("dispose unregisters the contract", () => {
    const peer = createMockScompPeer();
    const { dispose } = wirePopoutManifestContract(peer, () => "win-1");

    const disposeFn = (peer.register as ReturnType<typeof vi.fn>).mock.results[0].value.dispose;
    dispose();
    expect(disposeFn).toHaveBeenCalled();
  });
});
