/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLinkInterceptor, parseGhostUrl } from "../dom/link-interceptor.js";

describe("parseGhostUrl", () => {
  it("parses ghost://route/X?p=v into route target", () => {
    const result = parseGhostUrl("ghost://route/vessel.detail?vesselId=v123");
    expect(result).toEqual({ route: "vessel.detail", params: { vesselId: "v123" } });
  });

  it("parses ghost://intent/X?f=v into intent target", () => {
    const result = parseGhostUrl("ghost://intent/domain.entity.open?entityType=vessel&entityId=v123");
    expect(result).toEqual({
      intent: "domain.entity.open",
      facts: { entityType: "vessel", entityId: "v123" },
    });
  });

  it("returns null for non-ghost href", () => {
    expect(parseGhostUrl("https://example.com")).toBeNull();
  });

  it("returns null for malformed ghost:// URL", () => {
    expect(parseGhostUrl("ghost://")).toBeNull();
    expect(parseGhostUrl("ghost://route")).toBeNull();
    expect(parseGhostUrl("ghost://unknown/foo")).toBeNull();
  });
});

describe("createLinkInterceptor", () => {
  let root: HTMLDivElement;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    navigate = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  function createAnchor(href: string, attrs?: Record<string, string>): HTMLAnchorElement {
    const a = document.createElement("a");
    a.setAttribute("href", href);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        a.setAttribute(k, v);
      }
    }
    root.appendChild(a);
    return a;
  }

  function click(el: Element, opts?: Partial<MouseEventInit>): MouseEvent {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...opts });
    el.dispatchEvent(event);
    return event;
  }

  it("intercepts ghost:// href and calls navigate", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    const a = createAnchor("ghost://route/vessel.detail?vesselId=v1");
    const event = click(a);

    expect(navigate).toHaveBeenCalledWith({ route: "vessel.detail", params: { vesselId: "v1" } });
    expect(event.defaultPrevented).toBe(true);
    interceptor.dispose();
  });

  it("ignores non-ghost href", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    const a = createAnchor("https://example.com");
    const event = click(a);

    expect(navigate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    interceptor.dispose();
  });

  it("ignores clicks with modifier keys", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    const a = createAnchor("ghost://route/foo?x=1");

    click(a, { ctrlKey: true });
    click(a, { metaKey: true });
    click(a, { shiftKey: true });
    click(a, { altKey: true });

    expect(navigate).not.toHaveBeenCalled();
    interceptor.dispose();
  });

  it("skips data-ghost-external links", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    const a = createAnchor("ghost://route/foo?x=1", { "data-ghost-external": "" });
    click(a);

    expect(navigate).not.toHaveBeenCalled();
    interceptor.dispose();
  });

  it("skips data-ghost-navigate links", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    const a = createAnchor("ghost://route/foo?x=1", { "data-ghost-navigate": "" });
    click(a);

    expect(navigate).not.toHaveBeenCalled();
    interceptor.dispose();
  });

  it("skips disabled elements", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    const a = createAnchor("ghost://route/foo?x=1", { "aria-disabled": "true" });
    click(a);
    expect(navigate).not.toHaveBeenCalled();

    const a2 = createAnchor("ghost://route/foo?x=1", { disabled: "" });
    click(a2);
    expect(navigate).not.toHaveBeenCalled();
    interceptor.dispose();
  });

  it("dispose removes listener", () => {
    const interceptor = createLinkInterceptor({ root, navigate });
    interceptor.dispose();

    const a = createAnchor("ghost://route/foo?x=1");
    click(a);

    expect(navigate).not.toHaveBeenCalled();
  });
});
