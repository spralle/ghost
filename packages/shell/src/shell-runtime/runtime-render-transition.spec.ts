import { describe, expect, it } from "vitest";
import type { ComposedShellPart } from "../ui/parts-rendering.js";
import { deriveCloseableTabIds, rerenderAfterPluginToggle } from "./runtime-render-transition.js";

function part(id: string): ComposedShellPart {
  return {
    id,
    instanceId: id,
    definitionId: id,
    partDefinitionId: id,
    title: id,
    args: {},
    slot: "main",
    pluginId: "test.plugin",
  };
}

describe("runtime-render-transition", () => {
  it("deriveCloseableTabIds includes all parts", () => {
    const result = deriveCloseableTabIds([
      part("utility.sync"),
      part("tab-orders"),
      part("utility.dev-inspector"),
      part("tab-vessels"),
    ]);

    expect(result.has("utility.sync")).toBe(true);
    expect(result.has("tab-orders")).toBe(true);
    expect(result.has("utility.dev-inspector")).toBe(true);
    expect(result.has("tab-vessels")).toBe(true);
    expect(result.size).toBe(4);
  });

  it("plugin toggle rerender updates parts before panels", () => {
    const order: string[] = [];

    rerenderAfterPluginToggle(
      () => {
        order.push("parts");
      },
      () => {
        order.push("panels");
      },
    );

    expect(order[0]).toBe("parts");
    expect(order[1]).toBe("panels");
    expect(order.length).toBe(2);
  });
});
