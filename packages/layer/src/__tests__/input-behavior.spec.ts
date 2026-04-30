import { describe, expect, it } from "vitest";
import { InputBehavior, KeyboardInteractivity } from "@ghost-shell/contracts/layer";
import { applyInputBehavior, applyKeyboardInteractivity, createKeyboardExclusiveManager } from "../input-behavior.js";

// ---------------------------------------------------------------------------
// Minimal DOM mocks (no jsdom/happy-dom dependency)
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

interface MockDiv {
  style: Record<string, string> & CSSStyleDeclaration;
  dataset: Record<string, string | undefined>;
  tabIndex: number;
  focused: boolean;
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  blur(): void;
  focus(): void;
  contains(node: unknown): boolean;
}

function makeDiv(): MockDiv {
  const attrs: Record<string, string> = {};
  const div: MockDiv = {
    style: makeStyleProxy(),
    dataset: {},
    tabIndex: -1,
    focused: false,
    attributes: attrs,
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    blur() {
      div.focused = false;
    },
    focus() {
      div.focused = true;
    },
    contains(node: unknown) {
      return node === div;
    },
  };
  return div;
}

// Cast helper — our mock satisfies the subset used by the implementation
function asHtmlDiv(mock: MockDiv): HTMLDivElement {
  return mock as unknown as HTMLDivElement;
}

// Patch global document for applyKeyboardInteractivity (checks document.activeElement)
const originalDocument = (globalThis as Record<string, unknown>).document;
let currentlyFocused: MockDiv | null = null;

function setupDocumentMock(): void {
  const listeners: Array<{ type: string; handler: (e: unknown) => void; capture: boolean }> = [];
  (globalThis as Record<string, unknown>).document = {
    get activeElement() {
      return currentlyFocused as unknown;
    },
    addEventListener(type: string, handler: (e: unknown) => void, capture?: boolean) {
      listeners.push({ type, handler, capture: !!capture });
    },
    removeEventListener(type: string, handler: (e: unknown) => void, capture?: boolean) {
      const idx = listeners.findIndex((l) => l.type === type && l.handler === handler && l.capture === !!capture);
      if (idx !== -1) listeners.splice(idx, 1);
    },
    /** Expose for test inspection */
    _listeners: listeners,
  };
}

function teardownDocumentMock(): void {
  currentlyFocused = null;
  if (originalDocument !== undefined) {
    (globalThis as Record<string, unknown>).document = originalDocument;
  } else {
    delete (globalThis as Record<string, unknown>).document;
  }
}

function makeFocusableDiv(): MockDiv {
  const div = makeDiv();
  const origFocus = div.focus.bind(div);
  div.focus = () => {
    origFocus();
    currentlyFocused = div;
  };
  const origBlur = div.blur.bind(div);
  div.blur = () => {
    origBlur();
    if (currentlyFocused === div) currentlyFocused = null;
  };
  return div;
}

describe("input-behavior", () => {
  // ---------------------------------------------------------------------------
  // applyInputBehavior
  // ---------------------------------------------------------------------------

  it("applyInputBehavior opaque sets pointer-events auto", () => {
    const el = makeDiv();
    applyInputBehavior(asHtmlDiv(el), InputBehavior.Opaque);
    expect(el.style.pointerEvents).toBe("auto");
    expect(el.dataset.contentAware).toBe(undefined);
  });

  it("applyInputBehavior passthrough sets pointer-events none", () => {
    const el = makeDiv();
    applyInputBehavior(asHtmlDiv(el), InputBehavior.Passthrough);
    expect(el.style.pointerEvents).toBe("none");
  });

  it("applyInputBehavior content_aware sets pointer-events auto with marker", () => {
    const el = makeDiv();
    applyInputBehavior(asHtmlDiv(el), InputBehavior.ContentAware);
    expect(el.style.pointerEvents).toBe("auto");
    expect(el.dataset.contentAware).toBe("true");
  });

  it("applyInputBehavior switching from content_aware to opaque removes marker", () => {
    const el = makeDiv();
    applyInputBehavior(asHtmlDiv(el), InputBehavior.ContentAware);
    applyInputBehavior(asHtmlDiv(el), InputBehavior.Opaque);
    expect(el.dataset.contentAware).toBe(undefined);
  });

  // ---------------------------------------------------------------------------
  // applyKeyboardInteractivity
  // ---------------------------------------------------------------------------

  it("applyKeyboardInteractivity none sets tabindex -1", () => {
    setupDocumentMock();
    try {
      const el = makeFocusableDiv();
      applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.None);
      expect(el.getAttribute("tabindex")).toBe("-1");
    } finally {
      teardownDocumentMock();
    }
  });

  it("applyKeyboardInteractivity on_demand sets tabindex 0", () => {
    setupDocumentMock();
    try {
      const el = makeFocusableDiv();
      applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.OnDemand);
      expect(el.getAttribute("tabindex")).toBe("0");
    } finally {
      teardownDocumentMock();
    }
  });

  it("applyKeyboardInteractivity exclusive focuses element", () => {
    setupDocumentMock();
    try {
      const el = makeFocusableDiv();
      applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.Exclusive);
      expect(el.getAttribute("tabindex")).toBe("0");
      expect(el.focused).toBe(true);
    } finally {
      teardownDocumentMock();
    }
  });

  it("applyKeyboardInteractivity none blurs focused element", () => {
    setupDocumentMock();
    try {
      const el = makeFocusableDiv();
      el.focus();
      expect(currentlyFocused).toBe(el);
      applyKeyboardInteractivity(asHtmlDiv(el), KeyboardInteractivity.None);
      expect(el.focused).toBe(false);
    } finally {
      teardownDocumentMock();
    }
  });

  // ---------------------------------------------------------------------------
  // KeyboardExclusiveManager
  // ---------------------------------------------------------------------------

  it("pushExclusive installs capturing listeners on document", () => {
    setupDocumentMock();
    try {
      const manager = createKeyboardExclusiveManager();
      const el = makeFocusableDiv();
      manager.pushExclusive("s1", asHtmlDiv(el));

      const doc = (globalThis as Record<string, unknown>).document as {
        _listeners: Array<{ type: string; capture: boolean }>;
      };
      const capturingKeydown = doc._listeners.filter((l) => l.type === "keydown" && l.capture);
      expect(capturingKeydown.length > 0).toBe(true);

      manager.dispose();
    } finally {
      teardownDocumentMock();
    }
  });

  it("popExclusive removes listeners when stack empty", () => {
    setupDocumentMock();
    try {
      const manager = createKeyboardExclusiveManager();
      const el = makeFocusableDiv();
      manager.pushExclusive("s1", asHtmlDiv(el));
      manager.popExclusive("s1");

      expect(manager.getActiveExclusive()).toBe(null);

      const doc = (globalThis as Record<string, unknown>).document as {
        _listeners: Array<{ type: string; capture: boolean }>;
      };
      const capturingKeydown = doc._listeners.filter((l) => l.type === "keydown" && l.capture);
      expect(capturingKeydown.length).toBe(0);

      manager.dispose();
    } finally {
      teardownDocumentMock();
    }
  });

  it("multiple exclusives stack correctly — last wins", () => {
    setupDocumentMock();
    try {
      const manager = createKeyboardExclusiveManager();
      const el1 = makeFocusableDiv();
      const el2 = makeFocusableDiv();

      manager.pushExclusive("s1", asHtmlDiv(el1));
      manager.pushExclusive("s2", asHtmlDiv(el2));

      expect(manager.getActiveExclusive()?.surfaceId).toBe("s2");

      manager.popExclusive("s2");
      expect(manager.getActiveExclusive()?.surfaceId).toBe("s1");

      manager.dispose();
    } finally {
      teardownDocumentMock();
    }
  });

  it("getActiveExclusive returns null when stack is empty", () => {
    const manager = createKeyboardExclusiveManager();
    expect(manager.getActiveExclusive()).toBe(null);
    manager.dispose();
  });

  it("capturing listener suppresses events outside exclusive surface", () => {
    setupDocumentMock();
    try {
      const manager = createKeyboardExclusiveManager();
      const el = makeFocusableDiv();
      manager.pushExclusive("s1", asHtmlDiv(el));

      // Simulate the capturing handler behavior:
      // Get the installed handler and call it with a mock event outside the surface
      const doc = (globalThis as Record<string, unknown>).document as {
        _listeners: Array<{ type: string; handler: (e: unknown) => void; capture: boolean }>;
      };
      const capHandler = doc._listeners.find((l) => l.type === "keydown" && l.capture);

      let stopPropCalled = false;
      let stopImmediateCalled = false;
      const mockEvent = {
        target: { notTheSurface: true }, // not contained by el
        stopPropagation() {
          stopPropCalled = true;
        },
        stopImmediatePropagation() {
          stopImmediateCalled = true;
        },
      };

      capHandler?.handler(mockEvent);
      expect(stopPropCalled).toBe(true);
      expect(stopImmediateCalled).toBe(true);

      manager.dispose();
    } finally {
      teardownDocumentMock();
    }
  });

  it("capturing listener allows events inside exclusive surface", () => {
    setupDocumentMock();
    try {
      const manager = createKeyboardExclusiveManager();
      const el = makeFocusableDiv();
      manager.pushExclusive("s1", asHtmlDiv(el));

      const doc = (globalThis as Record<string, unknown>).document as {
        _listeners: Array<{ type: string; handler: (e: unknown) => void; capture: boolean }>;
      };
      const capHandler = doc._listeners.find((l) => l.type === "keydown" && l.capture);

      let stopPropCalled = false;
      const mockEvent = {
        target: asHtmlDiv(el), // the surface itself — contains returns true
        stopPropagation() {
          stopPropCalled = true;
        },
        stopImmediatePropagation() {},
      };

      capHandler?.handler(mockEvent);
      expect(stopPropCalled).toBe(false);

      manager.dispose();
    } finally {
      teardownDocumentMock();
    }
  });
});
