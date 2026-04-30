import { describe, expect, it } from "vitest";
import type { FocusGrabManager, FocusGrabOptions } from "../focus-grab.js";
import { LayerRegistry } from "../registry.js";
import type { LayerSurfaceContextOptions } from "../surface-context.js";
import { createLayerSurfaceContext } from "../surface-context.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Minimal DOM / global mocks
// ---------------------------------------------------------------------------

function makeStyleProxy(): Record<string, string> & CSSStyleDeclaration {
  const store: Record<string, string> = {};
  return new Proxy(store, {
    get(target, prop) {
      if (typeof prop === "string") return target[prop] ?? "";
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "string") target[prop] = value;
      return true;
    },
  }) as unknown as Record<string, string> & CSSStyleDeclaration;
}

interface MockElement {
  style: Record<string, string> & CSSStyleDeclaration;
  _computedVars: Record<string, string>;
}

function makeMockElement(computedVars?: Record<string, string>): MockElement & HTMLDivElement {
  return {
    style: makeStyleProxy(),
    _computedVars: computedVars ?? {},
    focus() {},
    tagName: "DIV",
  } as unknown as MockElement & HTMLDivElement;
}

// ResizeObserver mock
let capturedResizeCallback: ((entries: Array<{ contentRect: { width: number; height: number } }>) => void) | null =
  null;
let resizeObserverDisconnected = false;
let resizeObserverTarget: unknown = null;

class MockResizeObserver {
  constructor(callback: (entries: Array<{ contentRect: { width: number; height: number } }>) => void) {
    this.callback = callback;
    capturedResizeCallback = callback;
    resizeObserverDisconnected = false;
  }

  observe(target: unknown): void {
    resizeObserverTarget = target;
  }

  disconnect(): void {
    resizeObserverDisconnected = true;
    capturedResizeCallback = null;
  }

  unobserve(): void {}
}

// getComputedStyle mock
const originalGetComputedStyle = globalThis.getComputedStyle;

// Install global mocks
(globalThis as unknown as Record<string, unknown>).ResizeObserver = MockResizeObserver;

// ---------------------------------------------------------------------------
// Mock FocusGrabManager
// ---------------------------------------------------------------------------

interface GrabCall {
  surfaceId: string;
  surfaceElement: unknown;
  layerContainer: unknown;
  config: unknown;
}

function makeMockFocusGrabManager(): FocusGrabManager & { grabCalls: GrabCall[]; releaseCalls: string[] } {
  const grabCalls: GrabCall[] = [];
  const releaseCalls: string[] = [];
  return {
    grabCalls,
    releaseCalls,
    grabFocus(options: FocusGrabOptions): void {
      grabCalls.push({
        surfaceId: options.surfaceId,
        surfaceElement: options.surfaceElement,
        layerContainer: options.layerContainer,
        config: options.config,
      });
    },
    releaseFocus(surfaceId: string): void {
      releaseCalls.push(surfaceId);
    },
    getActiveGrab() {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: create default options
// ---------------------------------------------------------------------------

function makeOptions(overrides?: Partial<LayerSurfaceContextOptions>): LayerSurfaceContextOptions & {
  _focusGrabManager: ReturnType<typeof makeMockFocusGrabManager>;
  _onDismissCalls: number;
  _onLayerChangeCalls: string[];
  _onExclusiveZoneChangeCalls: number[];
} {
  const fgm = makeMockFocusGrabManager();
  const registry = new LayerRegistry();
  registry.registerBuiltinLayers();

  const onLayerChangeCalls: string[] = [];
  const onExclusiveZoneChangeCalls: number[] = [];
  let onDismissCalls = 0;

  const containerVars: Record<string, string> = {};
  const container = makeMockElement(containerVars);

  // Install getComputedStyle mock for this container
  (globalThis as unknown as Record<string, unknown>).getComputedStyle = (el: unknown) => {
    if (el === container) {
      return {
        getPropertyValue(prop: string) {
          return containerVars[prop] ?? "";
        },
      } as CSSStyleDeclaration;
    }
    return { getPropertyValue: () => "" } as unknown as CSSStyleDeclaration;
  };

  const opts: LayerSurfaceContextOptions = {
    surfaceId: "test-surface-1",
    element: makeMockElement() as unknown as HTMLDivElement,
    layerName: "overlay",
    layerContainer: container as unknown as HTMLElement,
    layerRegistry: registry,
    focusGrabManager: fgm,
    onDismiss: () => {
      onDismissCalls++;
    },
    onLayerChange: (name: string) => {
      onLayerChangeCalls.push(name);
    },
    onExclusiveZoneChange: (value: number) => {
      onExclusiveZoneChangeCalls.push(value);
    },
    ...overrides,
  };

  return {
    ...opts,
    _focusGrabManager: fgm,
    get _onDismissCalls() {
      return onDismissCalls;
    },
    _onLayerChangeCalls: onLayerChangeCalls,
    _onExclusiveZoneChangeCalls: onExclusiveZoneChangeCalls,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("surface-context", () => {
  it("context exposes surfaceId and layerName", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    expect(ctx.surfaceId).toBe("test-surface-1");
    expect(ctx.layerName).toBe("overlay");
  });

  it("onConfigure registers ResizeObserver on element", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    capturedResizeCallback = null;
    resizeObserverTarget = null;

    ctx.onConfigure(() => {});
    assert(capturedResizeCallback !== null, "ResizeObserver should be created");
    expect(resizeObserverTarget).toBe(opts.element);
  });

  it("onConfigure fires callback on size change", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    const sizes: Array<{ width: number; height: number }> = [];

    ctx.onConfigure((rect) => sizes.push(rect));

    assert(capturedResizeCallback !== null, "callback should be captured");
    capturedResizeCallback?.([{ contentRect: { width: 100, height: 200 } }]);
    expect(sizes.length).toBe(1);
    expect(sizes[0].width).toBe(100);
    expect(sizes[0].height).toBe(200);
  });

  it("onConfigure dispose disconnects ResizeObserver", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    resizeObserverDisconnected = false;

    const sub = ctx.onConfigure(() => {});
    sub.dispose();
    assert(resizeObserverDisconnected, "ResizeObserver should be disconnected");
  });

  it("onClose callback invoked on dismiss", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    let called = false;

    ctx.onClose(() => {
      called = true;
    });
    ctx.dismiss();
    assert(called, "onClose callback should fire on dismiss");
  });

  it("onClose dispose removes callback", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    let called = false;

    const sub = ctx.onClose(() => {
      called = true;
    });
    sub.dispose();
    ctx.dismiss();
    assert(!called, "disposed callback should not fire");
  });

  it("setLayer calls onLayerChange with valid layer name", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    ctx.setLayer("modal");
    expect(opts._onLayerChangeCalls.length).toBe(1);
    expect(opts._onLayerChangeCalls[0]).toBe("modal");
    expect(ctx.layerName).toBe("modal");
  });

  it("setLayer logs warning for invalid layer", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };

    ctx.setLayer("nonexistent");

    console.warn = origWarn;
    assert(warnings.length > 0, "should log a warning");
    assert(warnings[0].includes("nonexistent"), "warning should mention the layer name");
    expect(opts._onLayerChangeCalls.length).toBe(0);
  });

  it("setOpacity delegates to setDynamicOpacity", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    ctx.setOpacity(0.5);
    expect((opts.element as unknown as MockElement).style.opacity).toBe("0.5");
  });

  it("setExclusiveZone calls onExclusiveZoneChange", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    ctx.setExclusiveZone(42);
    expect(opts._onExclusiveZoneChangeCalls.length).toBe(1);
    expect(opts._onExclusiveZoneChangeCalls[0]).toBe(42);
  });

  it("dismiss invokes onClose callbacks and onDismiss", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    let closeCount = 0;

    ctx.onClose(() => {
      closeCount++;
    });
    ctx.onClose(() => {
      closeCount++;
    });
    ctx.dismiss();

    expect(closeCount).toBe(2);
    expect(opts._onDismissCalls).toBe(1);
  });

  it("dismiss cleans up ResizeObserver", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    resizeObserverDisconnected = false;

    ctx.onConfigure(() => {});
    ctx.dismiss();
    assert(resizeObserverDisconnected, "ResizeObserver disconnected on dismiss");
  });

  it("dismiss is idempotent", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    let closeCount = 0;
    ctx.onClose(() => {
      closeCount++;
    });

    ctx.dismiss();
    ctx.dismiss();
    expect(closeCount).toBe(1);
    expect(opts._onDismissCalls).toBe(1);
  });

  it("grabFocus delegates to focusGrabManager", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    ctx.grabFocus({ backdrop: true, dismissOnOutsideClick: true });

    expect(opts._focusGrabManager.grabCalls.length).toBe(1);
    const call = opts._focusGrabManager.grabCalls[0];
    expect(call.surfaceId).toBe("test-surface-1");
    expect(call.surfaceElement).toBe(opts.element);
    expect(call.layerContainer).toBe(opts.layerContainer);
  });

  it("releaseFocus delegates to focusGrabManager", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    ctx.releaseFocus();
    expect(opts._focusGrabManager.releaseCalls.length).toBe(1);
    expect(opts._focusGrabManager.releaseCalls[0]).toBe("test-surface-1");
  });

  it("getExclusiveZones reads CSS custom properties", () => {
    const opts = makeOptions();
    // Set some vars on the container
    (opts.layerContainer as unknown as MockElement)._computedVars["--layer-inset-top"] = "10";
    (opts.layerContainer as unknown as MockElement)._computedVars["--layer-inset-right"] = "20";

    const ctx = createLayerSurfaceContext(opts);
    const zones = ctx.getExclusiveZones();
    expect(zones.top).toBe(10);
    expect(zones.right).toBe(20);
    expect(zones.bottom).toBe(0);
    expect(zones.left).toBe(0);
  });

  it("context implements all required interface methods", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    const requiredMethods = [
      "onConfigure",
      "onClose",
      "getExclusiveZones",
      "setLayer",
      "setOpacity",
      "setExclusiveZone",
      "dismiss",
      "grabFocus",
      "releaseFocus",
    ] as const;

    for (const method of requiredMethods) {
      expect(typeof ctx[method]).toBe("function");
    }

    const requiredProps = ["surfaceId", "layerName"] as const;
    for (const prop of requiredProps) {
      assert(prop in ctx, `${prop} should exist`);
    }
  });

  it("onConfigure twice disconnects first ResizeObserver", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);

    ctx.onConfigure(() => {});
    const firstCb = capturedResizeCallback;
    // Patch disconnect tracking on the first observer instance
    const origDisconnect = MockResizeObserver.prototype.disconnect;
    let disconnectCount = 0;
    MockResizeObserver.prototype.disconnect = function (this: MockResizeObserver) {
      disconnectCount++;
      origDisconnect.call(this);
    };

    ctx.onConfigure(() => {});
    MockResizeObserver.prototype.disconnect = origDisconnect;

    assert(disconnectCount >= 1, "first observer should be disconnected when second is created");
    assert(capturedResizeCallback !== firstCb, "second observer should replace the first");
  });

  it("setLayer moves element to new layer container", () => {
    const opts = makeOptions();
    // Build a minimal DOM tree: layerHost > [overlay container, modal container]
    const layerHost = {
      querySelector: (sel: string) => {
        if (sel === '.shell-layer[data-layer="modal"]') return modalContainer;
        return null;
      },
    };
    const modalContainer = {
      appendChild: (_el: unknown) => {
        appendedTo = modalContainer;
      },
    };
    let appendedTo: unknown = null;

    // Wire layerContainer.parentElement to our mock layerHost
    const container = { ...opts.layerContainer, parentElement: layerHost } as unknown as HTMLElement;
    const ctxOpts = { ...opts, layerContainer: container };
    const ctx = createLayerSurfaceContext(ctxOpts);

    ctx.setLayer("modal");
    expect(appendedTo).toBe(modalContainer);
  });

  it("grabFocus onDismiss does not double-fire dismiss", () => {
    const opts = makeOptions();
    const ctx = createLayerSurfaceContext(opts);
    let closeCount = 0;
    ctx.onClose(() => {
      closeCount++;
    });

    // First dismiss via grabFocus path
    ctx.dismiss();
    // Second dismiss (simulating grabFocus→onDismiss recursion)
    ctx.dismiss();

    expect(closeCount).toBe(1);
    expect(opts._onDismissCalls).toBe(1);
  });
});

// Restore
(globalThis as unknown as Record<string, unknown>).getComputedStyle = originalGetComputedStyle;
