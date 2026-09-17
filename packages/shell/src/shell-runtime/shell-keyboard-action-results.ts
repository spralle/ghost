import type { ShellRuntime, StateHost } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";

export interface ShellKeyboardActionResult {
  handled: boolean;
  executed: boolean;
  message: string;
}

export interface ShellContextMutationResult {
  state: StateHost["contextState"];
  changed: boolean;
}

export function applyContextMutation(
  runtime: ShellRuntime,
  result: ShellContextMutationResult,
  actionId: string,
  unavailableReason: string,
): ShellKeyboardActionResult {
  if (!result.changed) {
    return unavailable(actionId, unavailableReason);
  }

  updateContextState(runtime, result.state);
  runtime.selectedPartId = result.state.activeTabId;
  runtime.selectedPartTitle = result.state.activeTabId
    ? (result.state.tabs[result.state.activeTabId]?.label ?? result.state.activeTabId)
    : null;

  return executed(actionId);
}

export function executed(actionId: string): ShellKeyboardActionResult {
  return {
    handled: true,
    executed: true,
    message: `Keybinding action '${actionId}' executed.`,
  };
}

export function unavailable(actionId: string, reason: string): ShellKeyboardActionResult {
  return {
    handled: true,
    executed: false,
    message: `Keybinding action '${actionId}' is a no-op: ${reason}.`,
  };
}
