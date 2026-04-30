import { describe, expect, it } from "vitest";
import { FormrError } from "@ghost-shell/formr-core";
import { RendererRegistry } from "../renderer-registry.js";

describe("RendererRegistry", () => {
  it("has built-in renderers for group, section, field, array", () => {
    const registry = new RendererRegistry();
    expect(registry.has("group")).toBe(true);
    expect(registry.has("section")).toBe(true);
    expect(registry.has("field")).toBe(true);
    expect(registry.has("array")).toBe(true);
  });

  it("returns false for unknown types", () => {
    const registry = new RendererRegistry();
    expect(registry.has("unknown-widget")).toBe(false);
  });

  it("get returns undefined for unknown types", () => {
    const registry = new RendererRegistry();
    expect(registry.get("unknown-widget")).toBeUndefined();
  });

  it("get returns component for built-in types", () => {
    const registry = new RendererRegistry();
    expect(registry.get("group")).toBeFunction();
    expect(registry.get("section")).toBeFunction();
    expect(registry.get("field")).toBeFunction();
    expect(registry.get("array")).toBeFunction();
  });

  it("resolve returns component for built-in types", () => {
    const registry = new RendererRegistry();
    expect(registry.resolve("group")).toBeFunction();
  });

  it("resolve throws FORMR_RENDERER_UNKNOWN_TYPE for unknown types", () => {
    const registry = new RendererRegistry();
    try {
      registry.resolve("map-picker");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FormrError);
      expect((err as FormrError).code).toBe("FORMR_RENDERER_UNKNOWN_TYPE");
      expect((err as FormrError).message).toContain("map-picker");
    }
  });

  it("register adds a custom renderer", () => {
    const registry = new RendererRegistry();
    const CustomComponent = () => null;
    registry.register({ type: "map-picker", component: CustomComponent });
    expect(registry.has("map-picker")).toBe(true);
    expect(registry.get("map-picker")).toBe(CustomComponent);
    expect(registry.resolve("map-picker")).toBe(CustomComponent);
  });

  it("register overrides a built-in renderer", () => {
    const registry = new RendererRegistry();
    const CustomGroup = () => null;
    registry.register({ type: "group", component: CustomGroup });
    expect(registry.resolve("group")).toBe(CustomGroup);
  });
});
