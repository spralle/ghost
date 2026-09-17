import type { NormalizedKeybindingChord } from "@ghost-shell/commands";
import { createKeybindingService, type KeybindingService } from "@ghost-shell/commands";
import type { IntentActionMatch, ShellIntent } from "@ghost-shell/intents";
import type { ActionKeybinding, ActionSurface } from "../action-surface.js";
import type { BridgeHost, ShellRuntime } from "../app/types.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import type { WorkspaceSwitchDeps } from "../ui/workspace-switch.js";
import { DEFAULT_SHELL_KEYBINDING_PLUGIN_ID } from "./default-shell-keybindings.js";
import { dispatchExactMatch } from "./keyboard-action-dispatcher.js";
import { handleChooserKeyboardEvent } from "./keyboard-chooser-handler.js";
import { handleDegradedKeydown } from "./keyboard-degraded-handler.js";
import { readLocalStorageItem } from "./keyboard-local-storage.js";
import {
  createSequenceStateManager,
  readSequenceTimeoutMs,
  type SequenceStateManager,
  startSequenceTimeout,
} from "./keyboard-sequence-state.js";
import { handleTabLifecycleShortcut, handleTabScopeNavigation } from "./keyboard-tab-navigation.js";

export { dismissIntentChooser } from "./keyboard-chooser-handler.js";

export interface KeyboardBindings {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  dismissIntentChooser: () => void;
  executeResolvedAction: (match: IntentActionMatch, intent: ShellIntent | null) => Promise<void>;
  applySelection: (event: import("@ghost-shell/bridge").SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderEdgeSlots: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
  toActionContext: () => Record<string, string>;
  getDefaultKeybindings: () => ActionKeybinding[];
  getUserOverrideKeybindings: () => ActionKeybinding[];
  getWorkspaceSwitchDeps: () => WorkspaceSwitchDeps;
}

const DEBUG_KEYBINDINGS = readLocalStorageItem("ghost.debug.keybindings") === "true";

function computeOverrideFingerprint(overrides: ActionKeybinding[]): string {
  if (overrides.length === 0) return "";
  return overrides.map((o) => `${o.action}:${o.keybinding}`).join("|");
}

/** Handle chord sequence resolution: exact match, prefix, or no-match cancellation. */
async function handleChordResolution(
  event: KeyboardEvent,
  normalizedChord: NormalizedKeybindingChord,
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  keybindingService: KeybindingService,
  sequenceManager: SequenceStateManager,
): Promise<boolean> {
  const sequenceState = sequenceManager.get();

  if (!sequenceState && handleTabLifecycleShortcut(normalizedChord.value, event, runtime, bindings)) {
    return true;
  }

  const chords = sequenceState ? [...sequenceState.pressedChords, normalizedChord] : [normalizedChord];
  const context = bindings.toActionContext();
  const resolution = keybindingService.resolveSequence(chords, context);

  if (resolution.kind === "exact") {
    sequenceManager.clear();
    const action = resolution.match?.action;
    if (action) {
      const shouldPreventDefault = await dispatchExactMatch(
        root,
        runtime,
        bindings,
        keybindingService,
        chords,
        context,
        action,
      );
      if (shouldPreventDefault) {
        event.preventDefault();
      }
    }
    return true;
  }

  if (resolution.kind === "prefix") {
    event.preventDefault();
    sequenceManager.set({
      pressedChords: chords,
      timeoutHandle: null,
      startedAt: sequenceState?.startedAt ?? Date.now(),
    });
    startSequenceTimeout(sequenceManager, keybindingService, bindings, DEBUG_KEYBINDINGS);
    keybindingService.fireKeySequencePending({
      pressedChords: chords.map((c) => c.value),
      candidateCount: resolution.prefixCount ?? 0,
    });
    bindings.renderSyncStatus();
    return true;
  }

  // kind === "none" — cancel any pending sequence
  if (sequenceState) {
    const cancelledChords = sequenceState.pressedChords.map((c) => c.value);
    sequenceManager.clear();
    keybindingService.fireKeySequenceCancelled({ chords: cancelledChords, reason: "no_match" });
    bindings.renderSyncStatus();
    return true;
  }

  return false;
}

export function bindKeyboardShortcuts(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
): () => void {
  let cachedService: KeybindingService | null = null;
  let cachedActionSurface: ActionSurface | null = null;
  let cachedOverrideFingerprint = "";

  function getKeybindingService(): KeybindingService {
    const overrides = bindings.getUserOverrideKeybindings();
    const fingerprint = computeOverrideFingerprint(overrides);
    if (cachedService && cachedActionSurface === runtime.actionSurface && cachedOverrideFingerprint === fingerprint) {
      return cachedService;
    }
    cachedActionSurface = runtime.actionSurface;
    cachedOverrideFingerprint = fingerprint;
    cachedService = createKeybindingService({
      actionSurface: runtime.actionSurface,
      intentRuntime: runtime.intentRuntime,
      defaultBindings: bindings.getDefaultKeybindings(),
      pluginBindings: runtime.actionSurface.keybindings.filter(
        (b) => b.pluginId !== DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      ),
      userOverrideBindings: overrides,
      sequenceTimeoutMs: readSequenceTimeoutMs(),
    });
    return cachedService;
  }

  const sequenceManager = createSequenceStateManager();

  const onKeyDown = async (event: KeyboardEvent) => {
    if (handleChooserKeyboardEvent(runtime, event, bindings)) return;

    const keybindingService = getKeybindingService();
    const sequenceState = sequenceManager.get();

    if (sequenceState && event.key === "Escape") {
      event.preventDefault();
      const cancelledChords = sequenceState.pressedChords.map((c) => c.value);
      sequenceManager.clear();
      keybindingService.fireKeySequenceCancelled({ chords: cancelledChords, reason: "escape" });
      bindings.renderSyncStatus();
      return;
    }

    if (runtime.syncDegraded) {
      handleDegradedKeydown(event, runtime, bindings, keybindingService, DEBUG_KEYBINDINGS);
      return;
    }

    const normalizedChord = keybindingService.normalizeEvent(event);
    if (normalizedChord) {
      const handled = await handleChordResolution(
        event,
        normalizedChord,
        root,
        runtime,
        bindings,
        keybindingService,
        sequenceManager,
      );
      if (handled) return;
    }

    const target = event.target;
    if (target instanceof HTMLElement) {
      if (handleTabScopeNavigation(root, event, target)) return;
      if (event.key === "Enter" && target.id === "context-value-input") {
        root.querySelector<HTMLButtonElement>("#context-apply")?.click();
        event.preventDefault();
      }
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", onKeyDown);
    return () => {
      sequenceManager.clear();
      document.removeEventListener("keydown", onKeyDown);
    };
  }
  root.addEventListener("keydown", onKeyDown);
  return () => {
    sequenceManager.clear();
    root.removeEventListener("keydown", onKeyDown);
  };
}
