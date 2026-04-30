import { describe, expect, it } from "vitest";
import { createFocusGrabManager } from "../focus-grab.js";
import type { KeyboardExclusiveManager } from "../input-behavior.js";

// ---------------------------------------------------------------------------
// Minimal DOM mocks
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
  className: string;
  focused: boolean;
  children: MockDiv[];
  parentNode: MockDiv | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  focus(): void;
  blur(): void;
  contains(node: unknown): boolean;
  remove(): void;
  insertBefore(newNode: unknown, refNode: unknown): void;
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
  _clickHandlers: Array<() => void>;
  click(): void;
}

function makeDiv(): MockDiv {
  const attrs: Record<string, string> = {};
  const div: MockDiv = {
    style: makeStyleProxy(),
    dataset: {},
    className: "",
    focused: false,
    children: [],
    parentNode: null,
    _clickHandlers: [],
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    focus() {
      div.focused = true;
    },
    blur() {
      div.focused = false;
    },
    contains(node: unknown) {
      return node === div;
    },
    remove() {
      if (div.parentNode) {
        const idx = div.parentNode.children.indexOf(div);
        if (idx !== -1) div.parentNode.children.splice(idx, 1);
        div.parentNode = null;
      }
    },
    insertBefore(newNode: unknown, refNode: unknown) {
      const child = newNode as MockDiv;
      child.parentNode = div;
      const refIdx = div.children.indexOf(refNode as MockDiv);
      if (refIdx !== -1) {
        div.children.splice(refIdx, 0, child);
      } else {
        div.children.push(child);
      }
    },
    addEventListener(type: string, handler: () => void) {
      if (type === "click") div._clickHandlers.push(handler);
    },
    removeEventListener(type: string, handler: () => void) {
      if (type === "click") {
        const idx = div._clickHandlers.indexOf(handler);
        if (idx !== -1) div._clickHandlers.splice(idx, 1);
      }
    },
    click() {
      for (const h of div._clickHandlers) h();
    },
  };
  return div;
}

function asHtmlDiv(mock: MockDiv): HTMLDivElement {
  return mock as unknown as HTMLDivElement;
}

function asHtmlElement(mock: MockDiv): HTMLElement {
  return mock as unknown as HTMLElement;
}

// Mock document.createElement
let rafCallbacks: Array<() => void> = [];
const originalDocument = (globalThis as Record<string, unknown>).document;

function setupMocks(): void {
  rafCallbacks = [];
  (globalThis as Record<string, unknown>).document = {
    createElement(_tag: string) {
      return makeDiv();
    },
    addEventListener() {},
    removeEventListener() {},
  };
  (globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => {
    rafCallbacks.push(cb);
    return 0;
  };
}

function teardownMocks(): void {
  if (originalDocument !== undefined) {
    (globalThis as Record<string, unknown>).document = originalDocument;
  } else {
    delete (globalThis as Record<string, unknown>).document;
  }
  delete (globalThis as Record<string, unknown>).requestAnimationFrame;
}

function flushRaf(): void {
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb();
}

// Mock keyboard exclusive manager
function makeMockKeyboardManager(): KeyboardExclusiveManager & {
  _stack: Array<{ surfaceId: string; element: HTMLDivElement }>;
} {
  const stack: Array<{ surfaceId: string; element: HTMLDivElement }> = [];
  return {
    _stack: stack,
    pushExclusive(surfaceId: string, element: HTMLDivElement) {
      const idx = stack.findIndex((e) => e.surfaceId === surfaceId);
      if (idx !== -1) stack.splice(idx, 1);
      stack.push({ surfaceId, element });
    },
    popExclusive(surfaceId: string) {
      const idx = stack.findIndex((e) => e.surfaceId === surfaceId);
      if (idx !== -1) stack.splice(idx, 1);
    },
    getActiveExclusive() {
      return stack.length > 0 ? stack[stack.length - 1] : null;
    },
    dispose() {
      stack.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("focus-grab", () => {
  it("grabFocus creates backdrop element in layer container", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      // Backdrop inserted before surface
      expect(container.children.length).toBe(2);
      const backdrop = container.children[0];
      expect(backdrop.className).toBe("layer-backdrop");
      expect(backdrop.dataset.grabSurface).toBe("s1");
    } finally {
      teardownMocks();
    }
  });

  it("backdrop has correct default background color", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      const backdrop = container.children[0];
      expect(backdrop.style.background).toBe("var(--ghost-backdrop)");
      expect(backdrop.style.position).toBe("absolute");
      expect(backdrop.style.inset).toBe("0");
      expect(backdrop.style.pointerEvents).toBe("auto");
    } finally {
      teardownMocks();
    }
  });

  it("custom backdrop color is applied", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: "rgba(255,0,0,0.5)" },
      });

      const backdrop = container.children[0];
      expect(backdrop.style.background).toBe("rgba(255,0,0,0.5)");
    } finally {
      teardownMocks();
    }
  });

  it("dismissOnOutsideClick=true: clicking backdrop calls onDismiss", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      let dismissed = false;
      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true, dismissOnOutsideClick: true },
        onDismiss: () => {
          dismissed = true;
        },
      });

      const backdrop = container.children[0];
      backdrop.click();
      expect(dismissed).toBe(true);
    } finally {
      teardownMocks();
    }
  });

  it("dismissOnOutsideClick=false: clicking backdrop does NOT call onDismiss", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      let dismissed = false;
      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true, dismissOnOutsideClick: false },
        onDismiss: () => {
          dismissed = true;
        },
      });

      const backdrop = container.children[0];
      backdrop.click();
      expect(dismissed).toBe(false);
    } finally {
      teardownMocks();
    }
  });

  it("backdrop=false: no backdrop element created but still grabs keyboard", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: false },
      });

      expect(container.children.length).toBe(1);
      expect(km._stack.length).toBe(1);
      expect(km._stack[0].surfaceId).toBe("s1");
    } finally {
      teardownMocks();
    }
  });

  it("releaseFocus removes backdrop from DOM", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      expect(container.children.length).toBe(2);

      manager.releaseFocus("s1");
      expect(container.children.length).toBe(1);
    } finally {
      teardownMocks();
    }
  });

  it("releaseFocus pops keyboard exclusive", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      expect(km._stack.length).toBe(1);
      manager.releaseFocus("s1");
      expect(km._stack.length).toBe(0);
    } finally {
      teardownMocks();
    }
  });

  it("multiple grabs stack correctly", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);

      const s1 = makeDiv();
      const s2 = makeDiv();
      const container = makeDiv();
      container.children.push(s1);
      s1.parentNode = container;
      container.children.push(s2);
      s2.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(s1),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      manager.grabFocus({
        surfaceId: "s2",
        surfaceElement: asHtmlDiv(s2),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      expect(manager.getActiveGrab()?.surfaceId).toBe("s2");
      expect(km._stack.length).toBe(2);

      manager.releaseFocus("s2");
      expect(manager.getActiveGrab()?.surfaceId).toBe("s1");
    } finally {
      teardownMocks();
    }
  });

  it("getActiveGrab returns null when no grabs", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      expect(manager.getActiveGrab()).toBe(null);
    } finally {
      teardownMocks();
    }
  });

  it("backdrop opacity transitions from 0 to 1 via requestAnimationFrame", () => {
    setupMocks();
    try {
      const km = makeMockKeyboardManager();
      const manager = createFocusGrabManager(km);
      const surface = makeDiv();
      const container = makeDiv();
      container.children.push(surface);
      surface.parentNode = container;

      manager.grabFocus({
        surfaceId: "s1",
        surfaceElement: asHtmlDiv(surface),
        layerContainer: asHtmlElement(container),
        config: { backdrop: true },
      });

      const backdrop = container.children[0];
      expect(backdrop.style.opacity).toBe("0");
      expect(backdrop.style.transition).toBe("opacity 150ms ease");

      flushRaf();
      expect(backdrop.style.opacity).toBe("1");
    } finally {
      teardownMocks();
    }
  });
});
