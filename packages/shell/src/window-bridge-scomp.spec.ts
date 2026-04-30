import type { AsyncWindowBridgeRejectReason } from "@ghost-shell/bridge";
import { createAsyncScompWindowBridge, normalizeScompFailureReason } from "@ghost-shell/bridge";
import { describe, expect, it } from "vitest";

class FakeScompTransport {
  publishError: unknown = null;
  healthListener: ((health: unknown) => void) | null = null;
  eventListener: ((event: unknown) => void) | null = null;
  closeCalls = 0;
  disposeCalls = 0;
  recoverCalls = 0;

  publish(): void {
    if (this.publishError) {
      throw this.publishError;
    }
  }

  subscribe(listener: (event: unknown) => void): () => void {
    this.eventListener = listener;
    return () => {
      this.eventListener = null;
    };
  }

  subscribeHealth(listener: (health: unknown) => void): () => void {
    this.healthListener = listener;
    return () => {
      this.healthListener = null;
    };
  }

  recover(): void {
    this.recoverCalls += 1;
  }

  close(): void {
    this.closeCalls += 1;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  emitEvent(event: unknown): void {
    this.eventListener?.(event);
  }

  emitHealth(health: unknown): void {
    this.healthListener?.(health);
  }
}

describe("window-bridge-scomp", () => {
  it("scomp adapter publishes accepted and routes parsed events", async () => {
    const transport = new FakeScompTransport();
    const bridge = createAsyncScompWindowBridge({
      channelName: "ghost.test.scomp",
      loadTransport: async () => transport,
    });

    const events: string[] = [];
    bridge.subscribe((event) => {
      events.push(event.type);
    });

    const result = await bridge.publish({
      type: "sync-probe",
      probeId: "probe-1",
      sourceWindowId: "window-a",
    });

    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(result.disposition).toBe("enqueued");
    }

    transport.emitEvent({
      type: "selection",
      selectedPartId: "tab-a",
      selectedPartTitle: "Tab A",
      selectionByEntityType: {},
      sourceWindowId: "window-b",
    });

    expect(events.length).toBe(1);
    expect(events[0]).toBe("selection");
  });

  it("scomp adapter normalizes health reasons and close teardown is deterministic", async () => {
    const transport = new FakeScompTransport();
    const bridge = createAsyncScompWindowBridge({
      channelName: "ghost.test.scomp.health",
      loadTransport: async () => transport,
    });

    const seen: Array<{ sequence: number; state: string; reason: AsyncWindowBridgeRejectReason | null }> = [];
    bridge.subscribeHealth((health) => {
      seen.push({
        sequence: health.sequence,
        state: health.state,
        reason: health.reason,
      });
    });

    await bridge.publish({
      type: "sync-probe",
      probeId: "probe-seed",
      sourceWindowId: "window-a",
    });

    transport.emitHealth({ state: "degraded", reason: "channel-error" });
    transport.emitHealth({ state: "degraded", reason: "channel-error" });
    transport.emitHealth({ state: "healthy" });

    expect(seen.length >= 3).toBe(true);
    expect(seen[0]?.state).toBe("healthy");
    expect(seen[1]?.state).toBe("degraded");
    expect(seen[1]?.reason).toBe("channel-error");

    bridge.close();
    bridge.close();
    expect(transport.closeCalls).toBe(1);
    expect(transport.disposeCalls).toBe(1);

    const rejectedAfterClose = await bridge.publish({
      type: "sync-probe",
      probeId: "probe-after-close",
      sourceWindowId: "window-a",
    });
    expect(rejectedAfterClose.status).toBe("rejected");
    if (rejectedAfterClose.status === "rejected") {
      expect(rejectedAfterClose.reason).toBe("closed");
    }
  });

  it("scomp adapter maps transport publish failures to normalized reject reasons", async () => {
    const transport = new FakeScompTransport();
    const bridge = createAsyncScompWindowBridge({
      channelName: "ghost.test.scomp.errors",
      loadTransport: async () => transport,
    });

    await bridge.publish({
      type: "sync-probe",
      probeId: "probe-ready",
      sourceWindowId: "window-a",
    });

    transport.publishError = new Error("channel unavailable during publish");
    const rejected = await bridge.publish({
      type: "sync-probe",
      probeId: "probe-error",
      sourceWindowId: "window-a",
    });
    expect(rejected.status).toBe("rejected");
    if (rejected.status === "rejected") {
      expect(rejected.reason).toBe("unavailable");
    }
  });

  it("scomp failure normalization maps known error classes", () => {
    expect(normalizeScompFailureReason(new Error("timed out"))).toBe("timeout");
    expect(normalizeScompFailureReason(new Error("channel broke"))).toBe("channel-error");
    expect(normalizeScompFailureReason(new Error("resource unavailable"))).toBe("unavailable");
    expect(normalizeScompFailureReason(new Error("bridge closed"))).toBe("closed");
  });
});
