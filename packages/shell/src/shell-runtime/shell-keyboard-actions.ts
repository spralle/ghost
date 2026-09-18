import {
  cycleTabGroup,
  cycleTabInActiveStack,
  equalizeSplits,
  explodeActiveStack,
  gotoTabByIndex,
  navigateBackInActiveStack,
  navigateForwardInActiveStack,
  reorderActiveTabInStack,
} from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";
import { getEffectivePlacementConfig } from "../placement/get-effective-strategy.js";
import { openPopout, requestPopoutFromHostShim } from "../ui/part-instance-popout-lifecycle.js";
import { closeTabThroughRuntime } from "../ui/parts-controller.js";
import {
  isShellKeyboardActionId,
  SHELL_UNAVAILABLE_ACTION_IDS,
  type ShellKeyboardActionId,
} from "./default-shell-keybindings.js";
import { GOD_MODE_ACTION_ID, handleGodModeAction } from "./god-mode.js";
import type { KeyboardBindings } from "./keyboard-handlers.js";
import {
  applyContextMutation,
  executed,
  type ShellKeyboardActionResult,
  unavailable,
} from "./shell-keyboard-action-results.js";
import { dispatchDirectionalAction } from "./shell-keyboard-directional-actions.js";

export type { ShellKeyboardActionResult } from "./shell-keyboard-action-results.js";

/** Set view of action IDs removed from default bindings but kept as no-op handlers. */
const UNAVAILABLE_ACTION_SET = new Set<string>(SHELL_UNAVAILABLE_ACTION_IDS);

export function handleShellKeyboardAction(
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  actionId: string,
): ShellKeyboardActionResult {
  if (actionId === GOD_MODE_ACTION_ID) {
    void handleGodModeAction(runtime);
    return executed(actionId);
  }

  if (actionId === "shell.window.fullscreen.toggle") {
    if (typeof document === "undefined") {
      return unavailable(actionId, "not in browser environment");
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
    return executed(actionId);
  }

  if (UNAVAILABLE_ACTION_SET.has(actionId)) {
    return unavailable(actionId, "action unavailable in browser shell runtime");
  }

  // Workspace actions are action-first: keybindings must flow through
  // runtime action handlers / dispatchSequence, not direct keyboard mutation.
  if (actionId.startsWith("shell.workspace.")) {
    return { handled: false, executed: false, message: "" };
  }

  if (!isShellKeyboardActionId(actionId)) {
    return { handled: false, executed: false, message: "" };
  }

  return dispatchShellKeyboardAction(runtime, bindings, actionId);
}

function dispatchShellKeyboardAction(
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult {
  return (
    dispatchViewActions(runtime, bindings, actionId) ??
    dispatchCycleAndNavActions(runtime, actionId) ??
    dispatchTabGotoAction(runtime, actionId) ??
    dispatchDirectionalAction(runtime, actionId) ??
    unavailable(actionId, "unrecognized shell keyboard action")
  );
}

function dispatchViewActions(
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  if (actionId === "shell.view.close") {
    const activeTabId = runtime.contextState.activeTabId;
    if (!activeTabId) {
      return unavailable(actionId, "no active tab");
    }

    const closed = closeTabThroughRuntime(runtime, activeTabId, {
      applySelection: bindings.applySelection,
      publishWithDegrade: bindings.publishWithDegrade,
      renderContextControls: bindings.renderContextControls,
      renderParts: bindings.renderParts,
      renderSyncStatus: bindings.renderSyncStatus,
    });
    return closed ? executed(actionId) : unavailable(actionId, "active tab is not closeable");
  }

  if (actionId === "shell.popout") {
    const activeTabId = runtime.contextState.activeTabId;
    if (!activeTabId) {
      return unavailable(actionId, "no active tab");
    }

    if (runtime.isPopout) {
      requestPopoutFromHostShim(activeTabId, runtime, {
        renderSyncStatus: bindings.renderSyncStatus,
      });
    } else {
      openPopout(activeTabId, runtime, {
        renderParts: bindings.renderParts,
        renderSyncStatus: bindings.renderSyncStatus,
      });
    }
    return executed(actionId);
  }

  return null;
}

function dispatchCycleAndNavActions(
  runtime: ShellRuntime,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  return (
    dispatchCycleActions(runtime, actionId) ??
    dispatchNavigationActions(runtime, actionId) ??
    dispatchStackMutationActions(runtime, actionId)
  );
}

function dispatchCycleActions(
  runtime: ShellRuntime,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  if (actionId === "shell.group.cycle.prev") {
    return applyContextMutation(runtime, cycleTabGroup(runtime.contextState, -1), actionId, "group cycle unavailable");
  }
  if (actionId === "shell.group.cycle.next") {
    return applyContextMutation(runtime, cycleTabGroup(runtime.contextState, 1), actionId, "group cycle unavailable");
  }
  if (actionId === "shell.stack.cycle.prev") {
    return applyContextMutation(
      runtime,
      cycleTabInActiveStack(runtime.contextState, -1),
      actionId,
      "stack cycle unavailable",
    );
  }
  if (actionId === "shell.stack.cycle.next") {
    return applyContextMutation(
      runtime,
      cycleTabInActiveStack(runtime.contextState, 1),
      actionId,
      "stack cycle unavailable",
    );
  }
  return null;
}

function dispatchNavigationActions(
  runtime: ShellRuntime,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  if (actionId === "shell.stack.navigate.back") {
    return applyContextMutation(
      runtime,
      navigateBackInActiveStack(
        runtime.contextState,
        runtime.placementRegistry,
        getEffectivePlacementConfig(runtime.placementConfig),
      ),
      actionId,
      "stack navigate back unavailable",
    );
  }
  if (actionId === "shell.stack.navigate.forward") {
    return applyContextMutation(
      runtime,
      navigateForwardInActiveStack(
        runtime.contextState,
        runtime.placementRegistry,
        getEffectivePlacementConfig(runtime.placementConfig),
      ),
      actionId,
      "stack navigate forward unavailable",
    );
  }
  return null;
}

function dispatchStackMutationActions(
  runtime: ShellRuntime,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  if (actionId === "shell.tab.reorder.prev") {
    return applyContextMutation(
      runtime,
      reorderActiveTabInStack(runtime.contextState, "previous"),
      actionId,
      "tab reorder unavailable",
    );
  }
  if (actionId === "shell.tab.reorder.next") {
    return applyContextMutation(
      runtime,
      reorderActiveTabInStack(runtime.contextState, "next"),
      actionId,
      "tab reorder unavailable",
    );
  }
  if (actionId === "shell.split.equalize") {
    return applyContextMutation(runtime, equalizeSplits(runtime.contextState), actionId, "no splits to equalize");
  }
  if (actionId === "shell.stack.explode") {
    return applyContextMutation(runtime, explodeActiveStack(runtime.contextState), actionId, "cannot explode stack");
  }
  return null;
}

function dispatchTabGotoAction(
  runtime: ShellRuntime,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  if (!actionId.startsWith("shell.tab.goto.")) {
    return null;
  }
  const index = Number(actionId.slice("shell.tab.goto.".length));
  if (index >= 1 && index <= 9) {
    return applyContextMutation(
      runtime,
      gotoTabByIndex(runtime.contextState, index),
      actionId,
      `no tab at position ${index}`,
    );
  }
  return null;
}
