// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScrollRestoration } from "../dom/scroll-restoration.js";

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
});
