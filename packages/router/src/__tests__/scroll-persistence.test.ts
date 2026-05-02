// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionScrollPersistence } from "../dom/scroll-persistence.js";
import type { ScrollSnapshot } from "../dom/scroll-restoration.js";

describe("createSessionScrollPersistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeSnapshot(wx: number, wy: number, containers?: [string, { x: number; y: number }][]): ScrollSnapshot {
    return {
      window: { x: wx, y: wy },
      containers: new Map(containers ?? []),
    };
  }

  it("load returns empty Map when sessionStorage is empty", () => {
    const adapter = createSessionScrollPersistence();
    const result = adapter.load();
    expect(result.size).toBe(0);
  });

  it("load returns empty Map and removes corrupt data on parse error", () => {
    sessionStorage.setItem("ghost-scroll-v1", "not-json{{{");
    const adapter = createSessionScrollPersistence();
    const result = adapter.load();
    expect(result.size).toBe(0);
    expect(sessionStorage.getItem("ghost-scroll-v1")).toBeNull();
  });

  it("persist and load round-trip with window and container positions", () => {
    const adapter = createSessionScrollPersistence();
    const entries = new Map<string, ScrollSnapshot>();
    entries.set("k1", makeSnapshot(10, 20, [["panel", { x: 5, y: 15 }]]));
    entries.set("k2", makeSnapshot(30, 40));

    adapter.persist(entries);
    const loaded = adapter.load();

    expect(loaded.size).toBe(2);
    const s1 = loaded.get("k1")!;
    expect(s1.window).toEqual({ x: 10, y: 20 });
    expect(s1.containers.get("panel")).toEqual({ x: 5, y: 15 });
    const s2 = loaded.get("k2")!;
    expect(s2.window).toEqual({ x: 30, y: 40 });
    expect(s2.containers.size).toBe(0);
  });

  it("containers Map correctly round-trips through JSON serialization", () => {
    const adapter = createSessionScrollPersistence();
    const containers: [string, { x: number; y: number }][] = [
      ["sidebar", { x: 0, y: 100 }],
      ["main", { x: 50, y: 200 }],
    ];
    const entries = new Map([["nav1", makeSnapshot(0, 0, containers)]]);

    adapter.persist(entries);
    const loaded = adapter.load();
    const snapshot = loaded.get("nav1")!;

    expect(snapshot.containers).toBeInstanceOf(Map);
    expect(snapshot.containers.size).toBe(2);
    expect(snapshot.containers.get("sidebar")).toEqual({ x: 0, y: 100 });
    expect(snapshot.containers.get("main")).toEqual({ x: 50, y: 200 });
  });

  it("uses custom storageKey", () => {
    const adapter = createSessionScrollPersistence({ storageKey: "custom-key" });
    adapter.persist(new Map([["k", makeSnapshot(1, 2)]]));
    expect(sessionStorage.getItem("custom-key")).not.toBeNull();
    expect(sessionStorage.getItem("ghost-scroll-v1")).toBeNull();
  });

  it("persist silently handles QuotaExceededError", () => {
    const adapter = createSessionScrollPersistence();
    vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    expect(() => {
      adapter.persist(new Map([["k", makeSnapshot(0, 0)]]));
    }).not.toThrow();
  });
});
