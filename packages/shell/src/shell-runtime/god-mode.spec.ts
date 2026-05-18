import { buildActionSurface } from "../action-surface.js";
import type { ShellRuntime } from "../app/types.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
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

export function registerGodModeSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("god-mode: validateGodModeAuth accepts correct secret", () => {
    assertEqual(validateGodModeAuth("ghost"), true, "correct secret should validate");
  });

  test("god-mode: validateGodModeAuth rejects wrong secret", () => {
    assertEqual(validateGodModeAuth("wrong"), false, "wrong secret should not validate");
  });

  test("god-mode: activateElevatedSession sets runtime state", () => {
    const runtime = createMinimalRuntime();
    activateElevatedSession(runtime);
    assertEqual(runtime.elevatedSession.active, true, "session should be active");
    assertTruthy(runtime.elevatedSession.activatedAt !== null, "activatedAt should be set");
    assertTruthy(runtime.notice.length > 0, "notice should be set");
  });

  test("god-mode: GOD_MODE_ACTION_ID is registered in action surface", () => {
    const runtime = createMinimalRuntime();
    const action = runtime.actionSurface.actions.find((a: { id: string }) => a.id === GOD_MODE_ACTION_ID);
    assertTruthy(action !== undefined, "god-mode action should exist in action surface");
  });

  test("god-mode: action is marked hidden in action surface", () => {
    const runtime = createMinimalRuntime();
    const action = runtime.actionSurface.actions.find((a: { id: string }) => a.id === GOD_MODE_ACTION_ID);
    assertEqual(action?.hidden, true, "god-mode action should be hidden");
  });

  test("god-mode: keybinding is marked hidden in action surface", () => {
    const runtime = createMinimalRuntime();
    const kb = runtime.actionSurface.keybindings.find((k: { action: string }) => k.action === GOD_MODE_ACTION_ID);
    assertTruthy(kb !== undefined, "god-mode keybinding should exist");
    assertEqual(kb?.hidden, true, "god-mode keybinding should be hidden");
  });

  test("god-mode: hidden actions excluded when filtering visible", () => {
    const runtime = createMinimalRuntime();
    const visibleActions = runtime.actionSurface.actions.filter((a) => !a.hidden);
    const godAction = visibleActions.find((a) => a.id === GOD_MODE_ACTION_ID);
    assertEqual(godAction, undefined, "hidden action should not appear in visible actions");
  });

  test("god-mode: hidden keybindings excluded when filtering visible", () => {
    const runtime = createMinimalRuntime();
    const visibleKbs = runtime.actionSurface.keybindings.filter((kb) => !kb.hidden);
    const godKb = visibleKbs.find((kb) => kb.action === GOD_MODE_ACTION_ID);
    assertEqual(godKb, undefined, "hidden keybinding should not appear in visible keybindings");
  });

  test("god-mode: keybinding is ctrl+shift+alt+g o d", () => {
    const runtime = createMinimalRuntime();
    const kb = runtime.actionSurface.keybindings.find((k: { action: string }) => k.action === GOD_MODE_ACTION_ID);
    assertEqual(kb?.keybinding, "ctrl+shift+alt+g o d", "keybinding should be the 3-chord sequence");
  });
}
