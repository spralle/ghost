import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal DOM mock — enough for createElement, querySelectorAll, insertBefore
// ---------------------------------------------------------------------------

interface MockEl {
  tagName: string;
  className: string;
  dataset: Record<string, string | undefined>;
  style: Record<string, string>;
  children: MockEl[];
  parentNode: MockEl | null;
  attributes: Record<string, string>;
  querySelector(sel: string): MockEl | null;
  querySelectorAll(sel: string): MockEl[];
  appendChild(child: MockEl): void;
  insertBefore(child: MockEl, ref: MockEl): void;
  remove(): void;
  setAttribute(name: string, value: string): void;
}

function makeMockEl(tag: string): MockEl {
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    className: "",
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    attributes: {},
    setAttribute(name: string, value: string) {
      el.attributes[name] = value;
    },
    querySelector(sel: string): MockEl | null {
      return matchSelector(el.children, sel, false)[0] ?? null;
    },
    querySelectorAll(sel: string): MockEl[] {
      return matchSelector(el.children, sel, true);
    },
    appendChild(child: MockEl) {
      child.parentNode = el;
      el.children.push(child);
    },
    insertBefore(child: MockEl, ref: MockEl) {
      child.parentNode = el;
      const idx = el.children.indexOf(ref);
      if (idx !== -1) {
        el.children.splice(idx, 0, child);
      } else {
        el.children.push(child);
      }
    },
    remove() {
      if (el.parentNode) {
        const idx = el.parentNode.children.indexOf(el);
        if (idx !== -1) el.parentNode.children.splice(idx, 1);
        el.parentNode = null;
      }
    },
  };
  return el;
}

/** Minimal selector matching for [data-z] and .shell-layer[data-layer="x"] */
function matchSelector(children: MockEl[], sel: string, all: boolean): MockEl[] {
  const results: MockEl[] = [];
  for (const child of children) {
    if (matchesSel(child, sel)) {
      results.push(child);
      if (!all) return results;
    }
  }
  return results;
}

function matchesSel(el: MockEl, sel: string): boolean {
  if (sel === "[data-z]") return el.dataset.z !== undefined;
  const m = sel.match(/\.shell-layer\[data-layer="(.+?)"\]/);
  if (m) return el.className.includes("shell-layer") && el.dataset.layer === m[1];
  return false;
}

function installDocMock(): void {
  vi.stubGlobal("document", {
    createElement(tag: string) {
      return makeMockEl(tag);
    },
  });
}

function restoreDoc(): void {
  vi.unstubAllGlobals();
}

function makeHost(...zOrders: number[]): MockEl {
  const host = makeMockEl("div");
  for (const z of zOrders) {
    const el = makeMockEl("section");
    el.className = "shell-layer";
    el.dataset.z = String(z);
    el.dataset.layer = `layer-${z}`;
    host.appendChild(el);
  }
  return host;
}

function asEl(mock: MockEl): HTMLElement {
  return mock as unknown as HTMLElement;
}

describe("layer-dom", () => {
  let createLayerContainer: typeof import("../layer-dom.js").createLayerContainer;
  let removeLayerContainer: typeof import("../layer-dom.js").removeLayerContainer;

  beforeAll(async () => {
    installDocMock();
    const mod = await import("../layer-dom.js");
    createLayerContainer = mod.createLayerContainer;
    removeLayerContainer = mod.removeLayerContainer;
  });

  afterAll(() => {
    restoreDoc();
  });
  // --- createLayerContainer ---

  it("createLayerContainer inserts at correct z-order position", () => {
    const host = makeHost(0, 100, 300, 600);
    const el = createLayerContainer(asEl(host), { name: "custom", zOrder: 150 });
    const mock = el as unknown as MockEl;
    expect(mock.dataset.layer).toBe("custom");
    expect(mock.dataset.z).toBe("150");
    const idx = host.children.indexOf(mock);
    expect(idx).toBe(2);
  });

  it("createLayerContainer appends when z-order is highest", () => {
    const host = makeHost(0, 100, 300);
    const el = createLayerContainer(asEl(host), { name: "top", zOrder: 999 });
    const mock = el as unknown as MockEl;
    expect(host.children[host.children.length - 1]).toBe(mock);
  });

  it("createLayerContainer sets correct attributes and style", () => {
    const host = makeHost();
    const el = createLayerContainer(asEl(host), { name: "test", zOrder: 42 });
    const mock = el as unknown as MockEl;
    expect(mock.className).toBe("shell-layer");
    expect(mock.style.zIndex).toBe("42");
    expect(mock.tagName).toBe("DIV");
  });

  // --- removeLayerContainer ---

  it("removeLayerContainer removes the correct element", () => {
    const host = makeHost(0, 100, 300);
    removeLayerContainer(asEl(host), "layer-100");
    expect(host.children.length).toBe(2);
  });

  it("removeLayerContainer is no-op for non-existent layer", () => {
    const host = makeHost(0, 100);
    removeLayerContainer(asEl(host), "nonexistent");
    expect(host.children.length).toBe(2);
  });
});
