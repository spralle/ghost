import type { WindowBridge, WindowBridgeEvent, WindowBridgeHealth } from "@ghost-shell/bridge";
import { createAsyncWindowBridgeCompatibilityShim, normalizeBridgePublishRejectionReason } from "@ghost-shell/bridge";
import { describe, expect, it } from "vitest";

class StubWindowBridge implements WindowBridge {
  available = true;
  shouldPublishSucceed = true;
  private readonly listeners = new Set<(event: WindowBridgeEvent) => void>();
  private readonly healthListeners = new Set<(health: WindowBridgeHealth) => void>();

  publish(): boolean {
    return this.shouldPublishSucceed;
  }

  subscribe(listener: (event: WindowBridgeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void {
    this.healthListeners.add(listener);
    listener({ degraded: false, reason: null });
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  recover(): void {
    // no-op in test bridge
  }

  close(): void {
    // no-op in test bridge
  }

  emitHealth(health: WindowBridgeHealth): void {
    for (const listener of this.healthListeners) {
      listener(health);
    }
  }
}

describe("async-bridge", () => {
  it("shim publish reports accepted/enqueued for successful legacy publish", async () => {
    const legacyBridge = new StubWindowBridge();
    const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);

    const result = await shim.publish({
      type: "sync-probe",
      probeId: "probe-1",
      sourceWindowId: "window-a",
    });

    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(result.disposition).toBe("enqueued");
    }
  });

  it("shim publish normalizes timeout and closed reasons", async () => {
    const legacyBridge = new StubWindowBridge();
    const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);

    const timeoutResult = await shim.publish(
      {
        type: "sync-probe",
        probeId: "probe-timeout",
        sourceWindowId: "window-a",
      },
      { timeoutMs: 0 },
    );
    expect(timeoutResult.status).toBe("rejected");
    if (timeoutResult.status === "rejected") {
      expect(timeoutResult.reason).toBe("timeout");
    }

    shim.close();
    const closedResult = await shim.publish({
      type: "sync-probe",
      probeId: "probe-closed",
      sourceWindowId: "window-a",
    });
    expect(closedResult.status).toBe("rejected");
    if (closedResult.status === "rejected") {
      expect(closedResult.reason).toBe("closed");
    }
  });

  it("shim health stream is deterministic by sequence and state changes", () => {
    const legacyBridge = new StubWindowBridge();
    const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);
    const seen: Array<{ sequence: number; state: string; reason: string | null }> = [];

    shim.subscribeHealth((health) => {
      seen.push({
        sequence: health.sequence,
        state: health.state,
        reason: health.reason,
      });
    });

    legacyBridge.emitHealth({ degraded: true, reason: "channel-error" });
    legacyBridge.emitHealth({ degraded: true, reason: "channel-error" });
    legacyBridge.emitHealth({ degraded: false, reason: null });

    expect(seen.length).toBe(3);
    expect(seen[0]?.state).toBe("healthy");
    expect(seen[1]?.state).toBe("degraded");
    expect(seen[2]?.state).toBe("healthy");
    expect(seen[1]?.sequence > seen[0]?.sequence).toBe(true);
    expect(seen[2]?.sequence > seen[1]?.sequence).toBe(true);
  });

  it("publish rejection taxonomy normalizes legacy reasons", () => {
    expect(normalizeBridgePublishRejectionReason("unavailable", false)).toBe("unavailable");
    expect(normalizeBridgePublishRejectionReason("channel-error", true)).toBe("channel-error");
    expect(normalizeBridgePublishRejectionReason("publish-failed", true)).toBe("publish-failed");
  });
});
