import type { KeybindingService, NormalizedKeybindingChord } from "@ghost-shell/commands";
import type { ShellRuntime } from "../app/types.js";
import { needsStructuralRender, updateDockTabVisibility } from "../ui/dock-tab-visibility.js";
import type { KeyboardBindings } from "./keyboard-handlers.js";
import { handleShellKeyboardAction } from "./shell-keyboard-actions.js";

export async function dispatchExactMatch(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  keybindingService: KeybindingService,
  chords: NormalizedKeybindingChord[],
  context: Record<string, string>,
  action: { id: string; pluginId: string },
): Promise<boolean> {
  const activated = await bindings.activatePluginForBoundary({
    pluginId: action.pluginId,
    triggerType: "action",
    triggerId: action.id,
  });
  if (!activated) {
    runtime.actionNotice = `Action '${action.id}' blocked: plugin '${action.pluginId}' is not active.`;
    return false;
  }

  const shellResult = handleShellKeyboardAction(runtime, bindings, action.id);
  let executed = shellResult.executed;
  if (!shellResult.handled) {
    const runtimeHandler = runtime.runtimeActionRegistry.get(action.id);
    if (runtimeHandler) {
      try {
        const runtimeResult = await runtimeHandler();
        executed = runtimeResult !== false;
      } catch (runtimeError) {
        console.warn("[shell:keybinding] runtime action failed", action.id, runtimeError);
        executed = false;
      }
    } else {
      const result = await keybindingService.dispatchSequence(chords, context);
      executed = result.executed;
    }
  }

  const chordStr = chords.map((c) => c.value).join(" ");
  runtime.actionNotice = shellResult.handled
    ? `Keybinding (${chordStr}): ${shellResult.message}`
    : executed
      ? `Keybinding (${chordStr}): Action '${action.id}' executed.`
      : `Keybinding (${chordStr}): Action '${action.id}' is not executable in current context.`;

  if (chords.length > 1) {
    keybindingService.fireKeySequenceCompleted({ chords: chords.map((c) => c.value), actionId: action.id });
  }

  if (shellResult.handled) {
    bindings.renderContextControls();
    bindings.renderEdgeSlots();
    if (shellResult.executed && needsStructuralRender(action.id)) {
      bindings.renderParts();
    } else if (shellResult.executed) {
      updateDockTabVisibility(root, runtime);
    }
    bindings.renderSyncStatus();
  } else if (executed) {
    bindings.renderContextControls();
    bindings.renderEdgeSlots();
    bindings.renderParts();
    bindings.renderSyncStatus();
  }

  return executed;
}
