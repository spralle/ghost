import type { ContextSyncEvent, SelectionSyncEvent, WindowBridgeEvent } from "@ghost-shell/bridge";
import { createAsyncWindowBridgeCompatibilityShim, createWindowBridge } from "@ghost-shell/bridge";
import { describe, expect, it } from "vitest";

type Listener = (event: MessageEvent<unknown>) => void;

class FakeBroadcastChannel {
  static lastInstance: FakeBroadcastChannel | null = null;

  private readonly listeners: Record<string, Listener[]> = {
    message: [],
    messageerror: [],
  };

  shouldThrowOnPost = false;
  closed = false;

  constructor(_name: string) {
    FakeBroadcastChannel.lastInstance = this;
  }

  addEventListener(type: "message" | "messageerror", listener: Listener): void {
    this.listeners[type].push(listener);
  }

  postMessage(data: unknown): void {
    if (this.shouldThrowOnPost) {
      throw new Error("post failed");
    }

    this.emit("message", data);
  }

  emit(type: "message" | "messageerror", data?: unknown): void {
    for (const listener of this.listeners[type]) {
      listener({ data } as MessageEvent<unknown>);
    }
  }

  close(): void {
    this.closed = true;
  }
}

describe("window-bridge", () => {
  it("unavailable bridge reports degraded health and no-op publish", () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

    try {
      const bridge = createWindowBridge("ghost.test.bridge.unavailable");
      let healthReason: string | null = null;
      let degraded = false;

      bridge.subscribeHealth((health) => {
        degraded = health.degraded;
        healthReason = health.reason;
      });

      expect(bridge.available).toBe(false);
      expect(bridge.publish({ type: "sync-probe", probeId: "p1", sourceWindowId: "w1" })).toBe(false);
      expect(degraded).toBe(true);
      expect(healthReason).toBe("unavailable");
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("bridge detects publish failure and can recover", () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const bridge = createWindowBridge("ghost.test.bridge.health");
      const channel = FakeBroadcastChannel.lastInstance;
      expect(channel).toBeTruthy();

      let degraded = false;
      let reason: string | null = null;
      bridge.subscribeHealth((health) => {
        degraded = health.degraded;
        reason = health.reason;
      });

      expect(bridge.publish({ type: "sync-probe", probeId: "p1", sourceWindowId: "w1" })).toBe(true);
      expect(degraded).toBe(false);

      channel!.shouldThrowOnPost = true;
      expect(bridge.publish({ type: "sync-probe", probeId: "p2", sourceWindowId: "w1" })).toBe(false);
      expect(degraded).toBe(true);
      expect(reason).toBe("publish-failed");

      channel!.shouldThrowOnPost = false;
      bridge.recover();
      expect(degraded).toBe(false);
      expect(reason).toBe(null);
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("bridge close deterministically tears down channel", () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const bridge = createWindowBridge("ghost.test.bridge.close");
      const channel = FakeBroadcastChannel.lastInstance;
      expect(channel).toBeTruthy();

      let eventCalls = 0;
      let healthCalls = 0;
      bridge.subscribe(() => {
        eventCalls += 1;
      });
      bridge.subscribeHealth(() => {
        healthCalls += 1;
      });

      bridge.close();
      channel?.emit("message", {
        type: "sync-probe",
        probeId: "p-after-close",
        sourceWindowId: "w-1",
      });

      expect(channel?.closed).toBe(true);
      expect(eventCalls).toBe(0);
      expect(healthCalls > 0).toBe(true);
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("bridge parses sync events and selection revisions", () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const bridge = createWindowBridge("ghost.test.bridge.parse");
      const channel = FakeBroadcastChannel.lastInstance;
      expect(channel).toBeTruthy();

      const seen: WindowBridgeEvent[] = [];
      bridge.subscribe((event) => {
        seen.push(event);
      });

      channel?.emit("message", {
        type: "selection",
        selectedPartId: "part-a",
        selectedPartTitle: "Part A",
        selectionByEntityType: {
          order: {
            selectedIds: ["o-1"],
            priorityId: "o-1",
          },
          vessel: {
            selectedIds: ["v-1"],
            priorityId: "v-1",
          },
        },
        revision: { timestamp: 10, writer: "w-a" },
        sourceWindowId: "window-a",
      });

      channel?.emit("message", {
        type: "sync-ack",
        probeId: "p-1",
        targetWindowId: "window-b",
        sourceWindowId: "window-a",
      });

      channel?.emit("message", {
        type: "selection",
        selectedPartId: "part-invalid",
        selectedPartTitle: "Invalid",
        revision: { timestamp: 10 },
        sourceWindowId: "window-a",
      });

      expect(seen.length).toBe(2);
      expect(seen[0]?.type).toBe("selection");
      expect(seen[1]?.type).toBe("sync-ack");

      const selectionEvent = seen[0] as SelectionSyncEvent;
      expect(selectionEvent.selectedPartInstanceId).toBe("part-a");
      expect(selectionEvent.selectedPartDefinitionId).toBe("part-a");

      channel?.emit("message", {
        type: "selection",
        selectedPartInstanceId: "tab-instance-a",
        selectedPartDefinitionId: "domain.orders",
        selectedPartTitle: "Orders",
        selectedPartId: "domain.orders",
        selectionByEntityType: {},
        sourceWindowId: "window-b",
      });

      const instanceAwareSelection = seen[2] as SelectionSyncEvent;
      expect(instanceAwareSelection.type).toBe("selection");
      expect(instanceAwareSelection.selectedPartId).toBe("domain.orders");
      expect(instanceAwareSelection.selectedPartInstanceId).toBe("tab-instance-a");
      expect(instanceAwareSelection.selectedPartDefinitionId).toBe("domain.orders");

      channel?.emit("message", {
        type: "selection",
        selectedPartInstanceId: "tab-instance-b",
        selectedPartDefinitionId: "domain.vessels",
        selectedPartTitle: "Vessels",
        selectionByEntityType: {},
        sourceWindowId: "window-c",
      });

      const migratedSelection = seen[3] as SelectionSyncEvent;
      expect(migratedSelection.type).toBe("selection");
      expect(migratedSelection.selectedPartId).toBe("tab-instance-b");
      expect(migratedSelection.selectedPartInstanceId).toBe("tab-instance-b");
      expect(migratedSelection.selectedPartDefinitionId).toBe("domain.vessels");
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("bridge parses popout restore and context tab/group sync payloads", () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const bridge = createWindowBridge("ghost.test.bridge.tab-context");
      const channel = FakeBroadcastChannel.lastInstance;
      expect(channel).toBeTruthy();

      const events: WindowBridgeEvent[] = [];
      bridge.subscribe((event) => {
        events.push(event);
      });

      channel?.emit("message", {
        type: "context",
        scope: "group",
        tabId: "tab-a",
        contextKey: "shell.group-context",
        contextValue: "ctx-a",
        revision: { timestamp: 20, writer: "window-a" },
        sourceWindowId: "window-a",
      });

      channel?.emit("message", {
        type: "context",
        scope: "group",
        groupId: "group-main",
        contextKey: "shell.group-context",
        contextValue: "ctx-main",
        revision: { timestamp: 21, writer: "window-b" },
        sourceWindowId: "window-b",
      });

      channel?.emit("message", {
        type: "popout-restore-request",
        tabId: "domain.unplanned-orders.part#instance-1",
        partId: "domain.unplanned-orders.part",
        hostWindowId: "host-window",
        sourceWindowId: "popout-window",
      });

      channel?.emit("message", {
        type: "popout-restore-request",
        partId: "legacy.part-id",
        hostWindowId: "host-window",
        sourceWindowId: "legacy-popout-window",
      });

      channel?.emit("message", {
        type: "popout-restore-request",
        partId: "missing-host-window",
        sourceWindowId: "popout-window",
      });

      channel?.emit("message", {
        type: "tab-close",
        tabId: "tab-a",
        sourceWindowId: "window-b",
      });

      channel?.emit("message", {
        type: "tab-close",
        sourceWindowId: "window-b",
      });

      channel?.emit("message", {
        type: "context",
        scope: "group",
        tabInstanceId: "tab-instance-a",
        partInstanceId: "tab-instance-a",
        partDefinitionId: "domain.orders",
        contextKey: "shell.group-context",
        contextValue: "ctx-instance",
        sourceWindowId: "window-c",
      });

      expect(events.length).toBe(6);
      expect(events[0]?.type).toBe("context");
      expect(events[1]?.type).toBe("context");
      expect(events[2]?.type).toBe("popout-restore-request");
      expect(events[3]?.type).toBe("popout-restore-request");
      expect(events[4]?.type).toBe("tab-close");
      expect(events[5]?.type).toBe("context");

      const contextFromTab = events[0] as ContextSyncEvent;
      expect(contextFromTab.tabInstanceId).toBe("tab-a");

      const contextFromInstance = events[5] as ContextSyncEvent;
      expect(contextFromInstance.tabId).toBe("tab-instance-a");
      expect(contextFromInstance.tabInstanceId).toBe("tab-instance-a");
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("bridge compatibility parses legacy and instance-aware migration payload variants", () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const bridge = createWindowBridge("ghost.test.bridge.compat");
      const channel = FakeBroadcastChannel.lastInstance;
      expect(channel).toBeTruthy();

      const parsed: Array<{ type: string; event: unknown }> = [];
      bridge.subscribe((event) => {
        parsed.push({ type: event.type, event });
      });

      channel?.emit("message", {
        type: "context",
        scope: "group",
        tabId: "orders.instance-a",
        groupId: "group-main",
        contextKey: "shell.group-context",
        contextValue: "ctx-by-tab",
        revision: { timestamp: 40, writer: "window-a" },
        sourceWindowId: "window-a",
        selectedPartId: "orders.legacy",
        selectedPartInstanceId: "orders.instance-a",
        selectedPartDefinitionId: "orders.definition",
      });

      channel?.emit("message", {
        type: "context",
        scope: "group",
        groupId: "group-main",
        contextKey: "shell.group-context",
        contextValue: "ctx-by-group",
        revision: { timestamp: 41, writer: "window-b" },
        sourceWindowId: "window-b",
        selectedPartInstanceId: "orders.instance-b",
        selectedPartDefinitionId: "orders.definition",
      });

      channel?.emit("message", {
        type: "popout-restore-request",
        partId: "orders.legacy",
        hostWindowId: "host-window",
        sourceWindowId: "popout-window",
      });

      channel?.emit("message", {
        type: "popout-restore-request",
        partId: "orders.legacy",
        partInstanceId: "orders.instance-a",
        hostWindowId: "host-window",
        sourceWindowId: "popout-window",
      });

      channel?.emit("message", {
        type: "tab-close",
        tabId: "orders.instance-a",
        sourceWindowId: "window-b",
      });

      channel?.emit("message", {
        type: "tab-close",
        tabId: "orders.instance-a",
        partInstanceId: "orders.instance-a",
        sourceWindowId: "window-b",
      });

      expect(parsed.length).toBe(6);
      expect(parsed[0]?.type).toBe("context");
      expect(parsed[1]?.type).toBe("context");
      expect(parsed[2]?.type).toBe("popout-restore-request");
      expect(parsed[3]?.type).toBe("popout-restore-request");
      expect(parsed[4]?.type).toBe("tab-close");
      expect(parsed[5]?.type).toBe("tab-close");
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("async compatibility shim returns accepted/enqueued and deterministic health snapshots", async () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const legacyBridge = createWindowBridge("ghost.test.bridge.async-shim");
      const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);
      const channel = FakeBroadcastChannel.lastInstance;
      expect(channel).toBeTruthy();

      const seenHealth: Array<{ sequence: number; state: string; reason: string | null }> = [];
      shim.subscribeHealth((health) => {
        seenHealth.push({
          sequence: health.sequence,
          state: health.state,
          reason: health.reason,
        });
      });

      const published = await shim.publish({
        type: "sync-probe",
        probeId: "probe-async-1",
        sourceWindowId: "window-a",
      });

      expect(published.status).toBe("accepted");
      if (published.status === "accepted") {
        expect(published.disposition).toBe("enqueued");
      }

      channel?.emit("messageerror");
      channel?.emit("messageerror");
      expect(seenHealth.length).toBe(2);
      expect(seenHealth[0]?.state).toBe("healthy");
      expect(seenHealth[1]?.state).toBe("degraded");
      expect(seenHealth[1]?.sequence > seenHealth[0]?.sequence).toBe(true);
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });

  it("async compatibility shim normalizes timeout and closed publish rejections", async () => {
    const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

    try {
      const legacyBridge = createWindowBridge("ghost.test.bridge.async-timeout");
      const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);

      const timedOut = await shim.publish(
        {
          type: "sync-probe",
          probeId: "probe-timeout",
          sourceWindowId: "window-a",
        },
        { timeoutMs: 0 },
      );
      expect(timedOut.status).toBe("rejected");
      if (timedOut.status === "rejected") {
        expect(timedOut.reason).toBe("timeout");
      }

      shim.close();
      const closed = await shim.publish({
        type: "sync-probe",
        probeId: "probe-closed",
        sourceWindowId: "window-a",
      });
      expect(closed.status).toBe("rejected");
      if (closed.status === "rejected") {
        expect(closed.reason).toBe("closed");
      }
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
    }
  });
});
