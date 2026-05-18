import { describe, expect, it } from "vitest";
import { buildActionSurface } from "../action-surface.js";
import type { ShellRuntime } from "../app/types.js";
import { createDefaultShellKeybindingContract } from "./default-shell-keybindings.js";
import { activateElevatedSession, GOD_MODE_ACTION_ID, validateGodModeAuth } from "./god-mode.js";

function createMinimalRuntime(): ShellRuntime {
  return {
    elevatedSession: { active: false, activatedAt: null },
    notice: "",
    actionNotice: "",
    actionSurface: buildActionSurface([createDefaultShellKeybindingContract()]),
  } as unknown as ShellRuntime;
}

describe("god mode", () => {
  it("god-mode: validateGodModeAuth accepts correct secret", () => {
    expect(validateGodModeAuth("ghost")).toBe(true);
  });

  it("god-mode: validateGodModeAuth rejects wrong secret", () => {
    expect(validateGodModeAuth("wrong")).toBe(false);
  });

  it("god-mode: activateElevatedSession sets runtime state", () => {
    const runtime = createMinimalRuntime();
    activateElevatedSession(runtime);
    expect(runtime.elevatedSession.active).toBe(true);
    expect(runtime.elevatedSession.activatedAt !== null).toBeTruthy();
    expect(runtime.notice.length > 0).toBeTruthy();
  });

  it("god-mode: GOD_MODE_ACTION_ID is registered in action surface", () => {
    const runtime = createMinimalRuntime();
    const action = runtime.actionSurface.actions.find((a: { id: string }) => a.id === GOD_MODE_ACTION_ID);
    expect(action !== undefined).toBeTruthy();
  });

  it("god-mode: action is marked hidden in action surface", () => {
    const runtime = createMinimalRuntime();
    const action = runtime.actionSurface.actions.find((a: { id: string }) => a.id === GOD_MODE_ACTION_ID);
    expect(action?.hidden).toBe(true);
  });

  it("god-mode: keybinding is marked hidden in action surface", () => {
    const runtime = createMinimalRuntime();
    const kb = runtime.actionSurface.keybindings.find((k: { action: string }) => k.action === GOD_MODE_ACTION_ID);
    expect(kb !== undefined).toBeTruthy();
    expect(kb?.hidden).toBe(true);
  });

  it("god-mode: hidden actions excluded when filtering visible", () => {
    const runtime = createMinimalRuntime();
    const visibleActions = runtime.actionSurface.actions.filter((a) => !a.hidden);
    const godAction = visibleActions.find((a) => a.id === GOD_MODE_ACTION_ID);
    expect(godAction).toBe(undefined);
  });

  it("god-mode: hidden keybindings excluded when filtering visible", () => {
    const runtime = createMinimalRuntime();
    const visibleKbs = runtime.actionSurface.keybindings.filter((kb) => !kb.hidden);
    const godKb = visibleKbs.find((kb) => kb.action === GOD_MODE_ACTION_ID);
    expect(godKb).toBe(undefined);
  });

  it("god-mode: keybinding is ctrl+shift+alt+g o d", () => {
    const runtime = createMinimalRuntime();
    const kb = runtime.actionSurface.keybindings.find((k: { action: string }) => k.action === GOD_MODE_ACTION_ID);
    expect(kb?.keybinding).toBe("ctrl+shift+alt+g o d");
  });
});
