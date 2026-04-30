import { describe, expect, it } from "vitest";
import type { KeyboardExclusiveManager } from "../input-behavior.js";
import { createSessionLockManager } from "../session-lock.js";

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

interface MockElement {
  style: Record<string, string> & CSSStyleDeclaration;
  dataset: Record<string, string | undefined>;
  className: string;
  tagName: string;
  focused: boolean;
  focus(): void;
  blur(): void;
}

function makeMockElement(tagName: string, className: string, layer: string, z: string): MockElement {
  return {
    style: makeStyleProxy(),
    dataset: { layer, z },
    className,
    tagName,
    focused: false,
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
  };
}

function makeMockDiv(): MockElement {
  return {
    style: makeStyleProxy(),
    dataset: {},
    className: "",
    tagName: "DIV",
    focused: false,
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
  };
}

/** Build a mock layerHost with standard shell-layer sections. */
function buildLayerHost(): {
  layerHost: MockElement & { _sections: MockElement[]; querySelectorAll: (sel: string) => MockElement[] };
  sections: Record<string, MockElement>;
} {
  const background = makeMockElement("SECTION", "shell-layer", "background", "0");
  const bottom = makeMockElement("SECTION", "shell-layer", "bottom", "100");
  const main = makeMockElement("MAIN", "shell shell-layer", "main", "200");
  const floating = makeMockElement("SECTION", "shell-layer", "floating", "300");
  const notification = makeMockElement("SECTION", "shell-layer", "notification", "400");
  const modal = makeMockElement("SECTION", "shell-layer", "modal", "500");
  const overlay = makeMockElement("SECTION", "shell-layer", "overlay", "600");

  const allSections = [background, bottom, main, floating, notification, modal, overlay];

  const layerHost = {
    ...makeMockDiv(),
    _sections: allSections,
    querySelectorAll(_sel: string): MockElement[] {
      return allSections;
    },
  };

  return {
    layerHost,
    sections: { background, bottom, main, floating, notification, modal, overlay },
  };
}

function makeMockKeyboardManager(): KeyboardExclusiveManager & {
  pushCalls: Array<{ surfaceId: string }>;
  popCalls: string[];
} {
  const pushCalls: Array<{ surfaceId: string }> = [];
  const popCalls: string[] = [];
  return {
    pushCalls,
    popCalls,
    pushExclusive(surfaceId: string, _element: HTMLDivElement) {
      pushCalls.push({ surfaceId });
    },
    popExclusive(surfaceId: string) {
      popCalls.push(surfaceId);
    },
    getActiveExclusive() {
      return null;
    },
    dispose() {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session-lock", () => {
  it("activateLock hides main layer with display:none", () => {
    const { layerHost, sections } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

    expect(sections.main.style.display).toBe("none");
  });

  it("activateLock sets visibility:hidden on layers below overlay", () => {
    const { layerHost, sections } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

    expect(sections.background.style.visibility).toBe("hidden");
    expect(sections.background.style.pointerEvents).toBe("none");
    expect(sections.bottom.style.visibility).toBe("hidden");
    expect(sections.floating.style.visibility).toBe("hidden");
    expect(sections.notification.style.visibility).toBe("hidden");
    expect(sections.modal.style.visibility).toBe("hidden");
    // Overlay should NOT be hidden
    expect(sections.overlay.style.visibility).toBe("");
    expect(sections.overlay.style.pointerEvents).toBe("");
  });

  it("activateLock pushes keyboard exclusive", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

    expect(kbd.pushCalls.length).toBe(1);
    expect(kbd.pushCalls[0].surfaceId).toBe("lock-1");
  });

  it("canAddSurface returns false for z > 600 when locked", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

    expect(mgr.canAddSurface(700)).toBe(false);
    expect(mgr.canAddSurface(601)).toBe(false);
  });

  it("canAddSurface returns true for z <= 600 when locked", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);

    expect(mgr.canAddSurface(600)).toBe(true);
    expect(mgr.canAddSurface(100)).toBe(true);
    expect(mgr.canAddSurface(0)).toBe(true);
  });

  it("canAddSurface returns true for any z when not locked", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });

    expect(mgr.canAddSurface(700)).toBe(true);
    expect(mgr.canAddSurface(600)).toBe(true);
    expect(mgr.canAddSurface(0)).toBe(true);
  });

  it("releaseLock restores main layer display", () => {
    const { layerHost, sections } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
    mgr.releaseLock("lock-1");

    expect(sections.main.style.display).toBe("");
  });

  it("releaseLock restores visibility on all layers", () => {
    const { layerHost, sections } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
    mgr.releaseLock("lock-1");

    expect(sections.background.style.visibility).toBe("");
    expect(sections.background.style.pointerEvents).toBe("");
    expect(sections.bottom.style.visibility).toBe("");
    expect(sections.floating.style.visibility).toBe("");
    expect(sections.notification.style.visibility).toBe("");
    expect(sections.modal.style.visibility).toBe("");
  });

  it("releaseLock pops keyboard exclusive", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
    mgr.releaseLock("lock-1");

    expect(kbd.popCalls.length).toBe(1);
    expect(kbd.popCalls[0]).toBe("lock-1");
  });

  it("only the correct surface ID can release the lock", () => {
    const { layerHost, sections } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
    mgr.releaseLock("wrong-surface");

    // Lock should still be active
    expect(mgr.isLocked()).toBe(true);
    expect(sections.main.style.display).toBe("none");
    expect(kbd.popCalls.length).toBe(0);
  });

  it("isLocked returns correct state", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    expect(mgr.isLocked()).toBe(false);
    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
    expect(mgr.isLocked()).toBe(true);
    mgr.releaseLock("lock-1");
    expect(mgr.isLocked()).toBe(false);
  });

  it("getActiveLockSurfaceId returns correct value", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface = makeMockDiv();
    const container = makeMockDiv();

    expect(mgr.getActiveLockSurfaceId()).toBe(null);
    mgr.activateLock("lock-1", surface as unknown as HTMLDivElement, container as unknown as HTMLElement);
    expect(mgr.getActiveLockSurfaceId()).toBe("lock-1");
    mgr.releaseLock("lock-1");
    expect(mgr.getActiveLockSurfaceId()).toBe(null);
  });

  it("activateLock is idempotent when already locked", () => {
    const { layerHost } = buildLayerHost();
    const kbd = makeMockKeyboardManager();
    const mgr = createSessionLockManager({
      layerHost: layerHost as unknown as HTMLElement,
      keyboardExclusiveManager: kbd,
    });
    const surface1 = makeMockDiv();
    const surface2 = makeMockDiv();
    const container = makeMockDiv();

    mgr.activateLock("lock-1", surface1 as unknown as HTMLDivElement, container as unknown as HTMLElement);
    mgr.activateLock("lock-2", surface2 as unknown as HTMLDivElement, container as unknown as HTMLElement);

    expect(mgr.getActiveLockSurfaceId()).toBe("lock-1");
    expect(kbd.pushCalls.length).toBe(1);
  });
});
