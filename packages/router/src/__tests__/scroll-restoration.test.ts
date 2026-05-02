// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScrollPersistence } from "../dom/scroll-persistence.js";
import { createScrollRestoration } from "../dom/scroll-restoration.js";
import type { ScrollSnapshot } from "../dom/scroll-restoration.js";

describe("createScrollRestoration", () => {
  let rafCallbacks: Array<() => void>;

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal("scrollX", 0);
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(window.history, "scrollRestoration", {
      value: "auto",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRaf() {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    for (const cb of cbs) cb();
  }

  it("sets scrollRestoration to manual on creation", () => {
    createScrollRestoration();
    expect(window.history.scrollRestoration).toBe("manual");
  });

  it("save captures window scroll position", () => {
    const sr = createScrollRestoration();
    vi.stubGlobal("scrollX", 100);
    vi.stubGlobal("scrollY", 200);

    sr.save("key1");

    const restored = sr.restore("key1");
    expect(restored).toBe(true);
    flushRaf();
    expect(window.scrollTo).toHaveBeenCalledWith(100, 200);
  });

  it("restore returns false for unknown key", () => {
    const sr = createScrollRestoration();
    expect(sr.restore("unknown")).toBe(false);
  });

  it("registerContainer tracks container scroll positions", () => {
    const sr = createScrollRestoration();
    const el = { scrollLeft: 50, scrollTop: 75, scrollTo: vi.fn() } as unknown as Element;

    sr.registerContainer("panel", el);
    vi.stubGlobal("scrollX", 10);
    vi.stubGlobal("scrollY", 20);
    sr.save("nav1");

    sr.restore("nav1");
    flushRaf();
    expect((el as unknown as { scrollTo: ReturnType<typeof vi.fn> }).scrollTo).toHaveBeenCalledWith(50, 75);
  });

  it("dispose clears snapshots and restores scrollRestoration", () => {
    const sr = createScrollRestoration();
    sr.save("key1");
    sr.dispose();

    expect(sr.restore("key1")).toBe(false);
    expect(window.history.scrollRestoration).toBe("auto");
  });

  it("onNavigate with isBack=false scrolls to top", () => {
    const sr = createScrollRestoration();
    sr.onNavigate({ prevKey: "old", nextKey: "new", isBack: false });
    flushRaf();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("onNavigate with isBack=true restores saved position", () => {
    const sr = createScrollRestoration();
    vi.stubGlobal("scrollX", 30);
    vi.stubGlobal("scrollY", 60);
    sr.save("target");

    sr.onNavigate({ nextKey: "target", isBack: true });
    flushRaf();
    expect(window.scrollTo).toHaveBeenCalledWith(30, 60);
  });

  it("multiple containers tracked independently", () => {
    const sr = createScrollRestoration();
    const el1 = { scrollLeft: 10, scrollTop: 20, scrollTo: vi.fn() } as unknown as Element;
    const el2 = { scrollLeft: 30, scrollTop: 40, scrollTo: vi.fn() } as unknown as Element;

    sr.registerContainer("a", el1);
    sr.registerContainer("b", el2);
    sr.save("k");

    sr.restore("k");
    flushRaf();
    expect((el1 as unknown as { scrollTo: ReturnType<typeof vi.fn> }).scrollTo).toHaveBeenCalledWith(10, 20);
    expect((el2 as unknown as { scrollTo: ReturnType<typeof vi.fn> }).scrollTo).toHaveBeenCalledWith(30, 40);
  });

  it("registerContainer returns dispose that removes container", () => {
    const sr = createScrollRestoration();
    const el = { scrollLeft: 5, scrollTop: 10, scrollTo: vi.fn() } as unknown as Element;

    const dispose = sr.registerContainer("c", el);
    dispose();

    sr.save("k2");
    sr.restore("k2");
    flushRaf();
    expect((el as unknown as { scrollTo: ReturnType<typeof vi.fn> }).scrollTo).not.toHaveBeenCalled();
  });

  describe("persistence integration", () => {
    function createMockPersistence(initial?: Map<string, ScrollSnapshot>): ScrollPersistence & {
      loadSpy: ReturnType<typeof vi.fn>;
      persistSpy: ReturnType<typeof vi.fn>;
      disposeSpy: ReturnType<typeof vi.fn>;
    } {
      const loadSpy = vi.fn(() => initial ?? new Map<string, ScrollSnapshot>());
      const persistSpy = vi.fn();
      const disposeSpy = vi.fn();
      return { load: loadSpy, persist: persistSpy, dispose: disposeSpy, loadSpy, persistSpy, disposeSpy };
    }

    it("hydrates snapshots from persistence on init", () => {
      const initial = new Map<string, ScrollSnapshot>([
        ["hydrated-key", { window: { x: 42, y: 84 }, containers: new Map() }],
      ]);
      const mock = createMockPersistence(initial);
      const sr = createScrollRestoration({ persistence: mock });

      const restored = sr.restore("hydrated-key");
      expect(restored).toBe(true);
      flushRaf();
      expect(window.scrollTo).toHaveBeenCalledWith(42, 84);
    });

    it("flushes on dispose before clearing", () => {
      let persistedSize = 0;
      const mock = createMockPersistence();
      mock.persistSpy.mockImplementation((entries: ReadonlyMap<string, ScrollSnapshot>) => {
        persistedSize = entries.size;
      });
      const sr = createScrollRestoration({ persistence: mock });
      vi.stubGlobal("scrollX", 5);
      vi.stubGlobal("scrollY", 10);
      sr.save("k");

      sr.dispose();
      expect(mock.persistSpy).toHaveBeenCalled();
      expect(persistedSize).toBe(1);
      expect(mock.disposeSpy).toHaveBeenCalled();
    });

    it("flushes on pagehide event", () => {
      const mock = createMockPersistence();
      createScrollRestoration({ persistence: mock });

      window.dispatchEvent(new Event("pagehide"));
      expect(mock.persistSpy).toHaveBeenCalled();
    });

    it("prunes oldest 25% when exceeding maxEntries", () => {
      const mock = createMockPersistence();
      const sr = createScrollRestoration({ persistence: mock, maxEntries: 4 });

      for (let i = 0; i < 4; i++) {
        vi.stubGlobal("scrollX", i);
        vi.stubGlobal("scrollY", i);
        sr.save(`key-${i}`);
      }
      mock.persistSpy.mockClear();

      // 5th entry triggers prune
      vi.stubGlobal("scrollX", 99);
      vi.stubGlobal("scrollY", 99);
      sr.save("key-4");

      // Should have pruned oldest 25% (1 entry) then flushed
      expect(mock.persistSpy).toHaveBeenCalled();
      expect(sr.restore("key-0")).toBe(false); // pruned
      expect(sr.restore("key-4")).toBe(true); // kept
    });

    it("removeByPrefix removes matching entries and flushes", () => {
      const mock = createMockPersistence();
      const sr = createScrollRestoration({ persistence: mock });

      vi.stubGlobal("scrollX", 1);
      vi.stubGlobal("scrollY", 1);
      sr.save("tab1/page1");
      sr.save("tab1/page2");
      sr.save("tab2/page1");
      mock.persistSpy.mockClear();

      sr.removeByPrefix("tab1/");
      expect(mock.persistSpy).toHaveBeenCalledTimes(1);
      expect(sr.restore("tab1/page1")).toBe(false);
      expect(sr.restore("tab1/page2")).toBe(false);
      expect(sr.restore("tab2/page1")).toBe(true);
    });

    it("existing behavior unchanged without persistence", () => {
      const sr = createScrollRestoration();
      vi.stubGlobal("scrollX", 7);
      vi.stubGlobal("scrollY", 14);
      sr.save("no-persist");
      expect(sr.restore("no-persist")).toBe(true);
    });
  });
});
