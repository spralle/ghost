/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach } from "vitest";
import { applyTitleTemplate, createHeadManager, mergeHeadConfigs } from "../head-manager.js";
import type { HeadConfig } from "../head-types.js";

describe("mergeHeadConfigs", () => {
  it("child title wins over parent", () => {
    const result = mergeHeadConfigs([{ title: "Parent" }, { title: "Child" }]);
    expect(result.title).toBe("Child");
  });

  it("meta tags merge by key (name/property)", () => {
    const parent: HeadConfig = { meta: [{ name: "description", content: "old" }] };
    const child: HeadConfig = { meta: [{ name: "description", content: "new" }] };
    const result = mergeHeadConfigs([parent, child]);
    expect(result.meta).toEqual([{ name: "description", content: "new" }]);
  });

  it("link tags merge by rel+type key", () => {
    const parent: HeadConfig = { link: [{ rel: "icon", href: "/old.ico" }] };
    const child: HeadConfig = { link: [{ rel: "icon", href: "/new.ico" }] };
    const result = mergeHeadConfigs([parent, child]);
    expect(result.link).toEqual([{ rel: "icon", href: "/new.ico" }]);
  });

  it("returns undefined meta/link when empty", () => {
    const result = mergeHeadConfigs([{ title: "Only title" }]);
    expect(result.meta).toBeUndefined();
    expect(result.link).toBeUndefined();
  });
});

describe("applyTitleTemplate", () => {
  it("replaces {title} placeholder", () => {
    expect(applyTitleTemplate("{title} | My App", "Dashboard")).toBe("Dashboard | My App");
  });
});

describe("createHeadManager", () => {
  beforeEach(() => {
    document.title = "";
    document.head.innerHTML = "";
  });

  it("apply sets document.title", () => {
    const manager = createHeadManager();
    manager.apply({ title: "Test Page" });
    expect(document.title).toBe("Test Page");
  });

  it("apply uses titleTemplate when provided", () => {
    const manager = createHeadManager({ titleTemplate: "{title} - Ghost" });
    manager.apply({ title: "Home" });
    expect(document.title).toBe("Home - Ghost");
  });

  it("apply adds managed meta tags", () => {
    const manager = createHeadManager();
    manager.apply({ meta: [{ name: "description", content: "Hello" }] });
    const el = document.head.querySelector('meta[data-ghost-managed="true"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute("content")).toBe("Hello");
  });

  it("apply adds managed link tags", () => {
    const manager = createHeadManager();
    manager.apply({ link: [{ rel: "icon", href: "/favicon.ico" }] });
    const el = document.head.querySelector('link[data-ghost-managed="true"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute("href")).toBe("/favicon.ico");
  });

  it("cleanup removes managed tags", () => {
    const manager = createHeadManager();
    manager.apply({ meta: [{ name: "test", content: "val" }] });
    manager.cleanup();
    const el = document.head.querySelector('meta[data-ghost-managed="true"]');
    expect(el).toBeNull();
  });

  it("empty config does not crash", () => {
    const manager = createHeadManager();
    expect(() => manager.apply({})).not.toThrow();
  });

  it("mergeAndApply merges then applies", () => {
    const manager = createHeadManager();
    manager.mergeAndApply([{ title: "Parent" }, { title: "Child" }]);
    expect(document.title).toBe("Child");
  });
});
