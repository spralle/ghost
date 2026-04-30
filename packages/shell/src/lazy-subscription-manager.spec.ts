import { describe, expect, it, vi } from "vitest";

import { createLazySubscriptionManager } from "./lazy-subscription-manager.js";

describe("lazy-subscription-manager", () => {
  it("does not activate until first acquire", () => {
    const onActivate = vi.fn().mockReturnValue(() => {});
    const mgr = createLazySubscriptionManager({ onActivate });

    expect(mgr.isActive("theme")).toBe(false);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("activates on first acquire", () => {
    const onActivate = vi.fn().mockReturnValue(() => {});
    const mgr = createLazySubscriptionManager({ onActivate });

    mgr.acquire("theme");
    expect(mgr.isActive("theme")).toBe(true);
    expect(onActivate).toHaveBeenCalledWith("theme");
    expect(mgr.getConsumerCount("theme")).toBe(1);
  });

  it("increments consumer count on repeated acquire", () => {
    const onActivate = vi.fn().mockReturnValue(() => {});
    const mgr = createLazySubscriptionManager({ onActivate });

    mgr.acquire("theme");
    mgr.acquire("theme");
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(mgr.getConsumerCount("theme")).toBe(2);
  });

  it("disposes when last consumer releases", () => {
    const dispose = vi.fn();
    const onActivate = vi.fn().mockReturnValue(dispose);
    const mgr = createLazySubscriptionManager({ onActivate });

    mgr.acquire("theme");
    mgr.acquire("theme");
    mgr.release("theme");
    expect(dispose).not.toHaveBeenCalled();
    expect(mgr.isActive("theme")).toBe(true);

    mgr.release("theme");
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(mgr.isActive("theme")).toBe(false);
  });

  it("release is a no-op for unknown services", () => {
    const mgr = createLazySubscriptionManager({ onActivate: vi.fn() });
    expect(() => mgr.release("unknown")).not.toThrow();
  });

  it("disposeAll cleans up all subscriptions", () => {
    const dispose1 = vi.fn();
    const dispose2 = vi.fn();
    let call = 0;
    const onActivate = vi.fn().mockImplementation(() => {
      call++;
      return call === 1 ? dispose1 : dispose2;
    });
    const mgr = createLazySubscriptionManager({ onActivate });

    mgr.acquire("theme");
    mgr.acquire("config");
    mgr.disposeAll();

    expect(dispose1).toHaveBeenCalled();
    expect(dispose2).toHaveBeenCalled();
    expect(mgr.isActive("theme")).toBe(false);
    expect(mgr.isActive("config")).toBe(false);
  });
});
