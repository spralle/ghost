import { describe, expect, test } from "vitest";
import { parseBridgeEvent } from "../window-bridge-parse.js";

describe("parseBridgeEvent", () => {
  test("returns null for null input", () => {
    expect(parseBridgeEvent(null)).toBeNull();
  });

  test("returns null for non-object input", () => {
    expect(parseBridgeEvent("string")).toBeNull();
    expect(parseBridgeEvent(42)).toBeNull();
    expect(parseBridgeEvent(undefined)).toBeNull();
  });

  test("returns null for unknown event type", () => {
    expect(parseBridgeEvent({ type: "unknown-type" })).toBeNull();
  });

  test("parses tab-close event", () => {
    const event = {
      type: "tab-close",
      tabId: "tab-1",
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("tab-close");
  });

  test("rejects tab-close with missing fields", () => {
    expect(parseBridgeEvent({ type: "tab-close" })).toBeNull();
    expect(parseBridgeEvent({ type: "tab-close", tabId: "t1" })).toBeNull();
  });

  test("parses sync-probe event", () => {
    const event = {
      type: "sync-probe",
      probeId: "probe-1",
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("sync-probe");
  });

  test("parses sync-ack event", () => {
    const event = {
      type: "sync-ack",
      probeId: "probe-1",
      targetWindowId: "win-2",
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("sync-ack");
  });

  test("rejects sync-ack with missing targetWindowId", () => {
    const event = {
      type: "sync-ack",
      probeId: "probe-1",
      sourceWindowId: "win-1",
    };
    expect(parseBridgeEvent(event)).toBeNull();
  });

  test("parses popout-restore-request event", () => {
    const event = {
      type: "popout-restore-request",
      tabId: "tab-1",
      hostWindowId: "host-1",
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("popout-restore-request");
  });

  test("rejects popout-restore-request with missing fields", () => {
    expect(
      parseBridgeEvent({
        type: "popout-restore-request",
        sourceWindowId: "win-1",
      }),
    ).toBeNull();
  });

  test("parses dnd-session-upsert event", () => {
    const event = {
      type: "dnd-session-upsert",
      id: "dnd-1",
      expiresAt: Date.now() + 5000,
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("dnd-session-upsert");
  });

  test("parses dnd-session-delete event", () => {
    const event = {
      type: "dnd-session-delete",
      id: "dnd-1",
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("dnd-session-delete");
  });

  test("parses selection event with valid selectionByEntityType", () => {
    const event = {
      type: "selection",
      selectedPartId: "part-1",
      selectedPartTitle: "Part 1",
      selectionByEntityType: {
        vessel: { selectedIds: ["v1", "v2"], priorityId: "v1" },
      },
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("selection");
  });

  test("rejects selection event with invalid selectionByEntityType", () => {
    const event = {
      type: "selection",
      selectedPartId: "part-1",
      selectedPartTitle: "Part 1",
      selectionByEntityType: { vessel: { selectedIds: [123] } },
      sourceWindowId: "win-1",
    };
    expect(parseBridgeEvent(event)).toBeNull();
  });

  test("parses context event", () => {
    const event = {
      type: "context",
      contextKey: "theme",
      contextValue: "dark",
      sourceWindowId: "win-1",
    };
    const result = parseBridgeEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("context");
  });
});
