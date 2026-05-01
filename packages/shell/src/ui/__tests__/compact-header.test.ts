/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompactHeader } from "../compact-header.js";

describe("createCompactHeader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("creates correct DOM structure with 3 children", () => {
    const header = createCompactHeader({ onBack: vi.fn(), onOverflow: vi.fn() });
    expect(header.element.tagName).toBe("HEADER");
    expect(header.element.children.length).toBe(3);
    expect(header.element.children[0].tagName).toBe("BUTTON");
    expect(header.element.children[1].tagName).toBe("H1");
    expect(header.element.children[2].tagName).toBe("BUTTON");
  });

  it("back button hidden when canGoBack is false", () => {
    const header = createCompactHeader({ onBack: vi.fn(), onOverflow: vi.fn() });
    header.update("Title", false);
    const backBtn = header.element.children[0] as HTMLElement;
    expect(backBtn.dataset.hidden).toBe("");
  });

  it("back button visible when canGoBack is true", () => {
    const header = createCompactHeader({ onBack: vi.fn(), onOverflow: vi.fn() });
    header.update("Title", true);
    const backBtn = header.element.children[0] as HTMLElement;
    expect(backBtn.dataset.hidden).toBeUndefined();
  });

  it("title updates when update() is called", () => {
    const header = createCompactHeader({ onBack: vi.fn(), onOverflow: vi.fn() });
    header.update("First", false);
    expect(header.element.children[1].textContent).toBe("First");
    header.update("Second", false);
    expect(header.element.children[1].textContent).toBe("Second");
  });

  it("click on back button fires onBack callback", () => {
    const onBack = vi.fn();
    const header = createCompactHeader({ onBack, onOverflow: vi.fn() });
    (header.element.children[0] as HTMLElement).click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("click on overflow button fires onOverflow callback", () => {
    const onOverflow = vi.fn();
    const header = createCompactHeader({ onBack: vi.fn(), onOverflow });
    (header.element.children[2] as HTMLElement).click();
    expect(onOverflow).toHaveBeenCalledOnce();
  });

  it("has correct aria-labels", () => {
    const header = createCompactHeader({ onBack: vi.fn(), onOverflow: vi.fn() });
    expect(header.element.children[0].getAttribute("aria-label")).toBe("Go back");
    expect(header.element.children[2].getAttribute("aria-label")).toBe("More actions");
  });
});
