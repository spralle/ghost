import { describe, expect, test } from "vitest";
import type { ActionSurface } from "../action-surface.js";
import { buildActionSurface, resolveMenuActions } from "../action-surface.js";

function makeContract(
  pluginId: string,
  contributions: {
    actions?: Array<{ id: string; title: string; intent: string; when?: any; hidden?: boolean }>;
    menus?: Array<{ menu: string; action: string; group?: string; order?: number; when?: any }>;
    keybindings?: Array<{ action: string; keybinding: string; when?: any }>;
  },
) {
  return {
    manifest: { id: pluginId },
    contributes: contributions,
  } as any;
}

const alwaysTrueMatcher = {
  evaluate: () => ({ matched: true }),
};

describe("buildActionSurface", () => {
  test("returns empty surface for no contracts", () => {
    const surface = buildActionSurface([]);
    expect(surface.actions).toEqual([]);
    expect(surface.menus).toEqual([]);
    expect(surface.keybindings).toEqual([]);
  });

  test("registers actions from contracts", () => {
    const contract = makeContract("plugin-a", {
      actions: [{ id: "action-1", title: "Action 1", intent: "intent.action1" }],
    });
    const surface = buildActionSurface([contract]);
    expect(surface.actions).toHaveLength(1);
    expect(surface.actions[0]?.id).toBe("action-1");
    expect(surface.actions[0]?.pluginId).toBe("plugin-a");
  });

  test("deduplicates actions by id", () => {
    const c1 = makeContract("plugin-a", {
      actions: [{ id: "action-1", title: "A1", intent: "i1" }],
    });
    const c2 = makeContract("plugin-b", {
      actions: [{ id: "action-1", title: "A1 duplicate", intent: "i1" }],
    });
    const surface = buildActionSurface([c1, c2]);
    expect(surface.actions).toHaveLength(1);
    expect(surface.actions[0]?.pluginId).toBe("plugin-a");
  });

  test("filters menus to only known actions", () => {
    const contract = makeContract("plugin-a", {
      actions: [{ id: "action-1", title: "A1", intent: "i1" }],
      menus: [
        { menu: "context", action: "action-1" },
        { menu: "context", action: "unknown-action" },
      ],
    });
    const surface = buildActionSurface([contract]);
    expect(surface.menus).toHaveLength(1);
    expect(surface.menus[0]?.action).toBe("action-1");
  });

  test("filters keybindings to only known actions", () => {
    const contract = makeContract("plugin-a", {
      actions: [{ id: "action-1", title: "A1", intent: "i1" }],
      keybindings: [
        { action: "action-1", keybinding: "ctrl+s" },
        { action: "missing", keybinding: "ctrl+m" },
      ],
    });
    const surface = buildActionSurface([contract]);
    expect(surface.keybindings).toHaveLength(1);
  });
});

describe("resolveMenuActions", () => {
  test("returns actions for a given menu id", () => {
    const contract = makeContract("plugin-a", {
      actions: [
        { id: "a1", title: "A1", intent: "i1" },
        { id: "a2", title: "A2", intent: "i2" },
      ],
      menus: [
        { menu: "context", action: "a1", order: 1 },
        { menu: "toolbar", action: "a2", order: 1 },
      ],
    });
    const surface = buildActionSurface([contract]);
    const result = resolveMenuActions(surface, "context", {}, alwaysTrueMatcher as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("a1");
  });

  test("returns empty array for unknown menu", () => {
    const surface: ActionSurface = { actions: [], menus: [], keybindings: [] };
    const result = resolveMenuActions(surface, "nonexistent", {}, alwaysTrueMatcher as any);
    expect(result).toEqual([]);
  });

  test("sorts menu items by group then order", () => {
    const contract = makeContract("plugin-a", {
      actions: [
        { id: "a1", title: "A1", intent: "i1" },
        { id: "a2", title: "A2", intent: "i2" },
        { id: "a3", title: "A3", intent: "i3" },
      ],
      menus: [
        { menu: "ctx", action: "a1", group: "b", order: 2 },
        { menu: "ctx", action: "a2", group: "a", order: 1 },
        { menu: "ctx", action: "a3", group: "b", order: 1 },
      ],
    });
    const surface = buildActionSurface([contract]);
    const result = resolveMenuActions(surface, "ctx", {}, alwaysTrueMatcher as any);
    expect(result.map((a) => a.id)).toEqual(["a2", "a3", "a1"]);
  });
});
