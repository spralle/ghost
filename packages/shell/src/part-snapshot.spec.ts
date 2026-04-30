import { describe, expect, it, vi } from "vitest";
import { capturePartSnapshot, restorePartSnapshot } from "./part-snapshot.js";

describe("capturePartSnapshot", () => {
  it("captures snapshot from SnapshotCapable part", () => {
    const part = {
      getSnapshot: () => ({ scrollTop: 100, selectedId: "abc" }),
      restoreSnapshot: vi.fn(),
    };

    const result = capturePartSnapshot("part-1", "plugin-1", part);
    expect(result).not.toBeNull();
    expect(result!.partId).toBe("part-1");
    expect(result!.snapshot).toEqual({ scrollTop: 100, selectedId: "abc" });
    expect(result!.capturedAt).toBeGreaterThan(0);
  });

  it("returns null for non-SnapshotCapable part", () => {
    const part = { render: () => {} };
    expect(capturePartSnapshot("part-1", "plugin-1", part)).toBeNull();
  });

  it("returns null if getSnapshot throws", () => {
    const part = {
      getSnapshot: () => {
        throw new Error("fail");
      },
      restoreSnapshot: vi.fn(),
    };
    expect(capturePartSnapshot("part-1", "plugin-1", part)).toBeNull();
  });
});

describe("restorePartSnapshot", () => {
  it("restores snapshot to SnapshotCapable part", () => {
    const part = {
      getSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
    };
    const snapshot = {
      partId: "part-1",
      pluginId: "plugin-1",
      snapshot: { scrollTop: 100 },
      capturedAt: Date.now(),
    };

    const result = restorePartSnapshot(part, snapshot);
    expect(result).toBe(true);
    expect(part.restoreSnapshot).toHaveBeenCalledWith({ scrollTop: 100 });
  });

  it("returns false for null snapshot", () => {
    const part = { getSnapshot: vi.fn(), restoreSnapshot: vi.fn() };
    expect(restorePartSnapshot(part, null)).toBe(false);
  });

  it("returns false for non-SnapshotCapable part", () => {
    const part = { render: () => {} };
    const snapshot = {
      partId: "part-1",
      pluginId: "plugin-1",
      snapshot: {},
      capturedAt: Date.now(),
    };
    expect(restorePartSnapshot(part, snapshot)).toBe(false);
  });

  it("returns false if restoreSnapshot throws", () => {
    const part = {
      getSnapshot: vi.fn(),
      restoreSnapshot: () => {
        throw new Error("fail");
      },
    };
    const snapshot = {
      partId: "part-1",
      pluginId: "plugin-1",
      snapshot: {},
      capturedAt: Date.now(),
    };
    expect(restorePartSnapshot(part, snapshot)).toBe(false);
  });
});
