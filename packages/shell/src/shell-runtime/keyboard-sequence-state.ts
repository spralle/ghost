import type { KeybindingService, NormalizedKeybindingChord } from "@ghost-shell/commands";
import type { KeyboardBindings } from "./keyboard-handlers.js";
import { readLocalStorageItem } from "./keyboard-local-storage.js";

const SEQUENCE_TIMEOUT_KEY = "ghost.keybindings.sequenceTimeoutMs";
const SEQUENCE_TIMEOUT_DEFAULT = 1000;
const SEQUENCE_TIMEOUT_MIN = 200;
const SEQUENCE_TIMEOUT_MAX = 5000;

/**
 * Read sequence timeout from localStorage with validation and clamping.
 * Returns default (1000ms) if value is missing, non-numeric, or out of range.
 */
export function readSequenceTimeoutMs(): number {
  const raw = readLocalStorageItem(SEQUENCE_TIMEOUT_KEY);
  if (raw == null) return SEQUENCE_TIMEOUT_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return SEQUENCE_TIMEOUT_DEFAULT;
  return Math.max(SEQUENCE_TIMEOUT_MIN, Math.min(SEQUENCE_TIMEOUT_MAX, Math.round(parsed)));
}

export interface ChordSequenceState {
  /** Chords accumulated so far */
  pressedChords: NormalizedKeybindingChord[];
  /** Timer handle for timeout cancellation */
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  /** Timestamp of first chord for debugging */
  startedAt: number;
}

export interface SequenceStateManager {
  get: () => ChordSequenceState | null;
  set: (state: ChordSequenceState | null) => void;
  clear: () => void;
}

export function createSequenceStateManager(): SequenceStateManager {
  let sequenceState: ChordSequenceState | null = null;

  return {
    get: () => sequenceState,
    set: (state) => {
      sequenceState = state;
    },
    clear: () => {
      if (sequenceState?.timeoutHandle != null) {
        clearTimeout(sequenceState.timeoutHandle);
      }
      sequenceState = null;
    },
  };
}

export function startSequenceTimeout(
  manager: SequenceStateManager,
  keybindingService: KeybindingService,
  bindings: Pick<KeyboardBindings, "renderSyncStatus">,
  debugKeybindings: boolean,
): void {
  const sequenceState = manager.get();
  if (sequenceState?.timeoutHandle != null) {
    clearTimeout(sequenceState.timeoutHandle);
  }
  if (sequenceState) {
    const timeoutChords = sequenceState.pressedChords.map((c) => c.value);
    const handle = setTimeout(() => {
      if (debugKeybindings) {
        console.debug("[shell:keybinding] sequence-timeout", { chords: timeoutChords });
      }
      manager.clear();
      keybindingService.fireKeySequenceCancelled({ chords: timeoutChords, reason: "timeout" });
      bindings.renderSyncStatus();
    }, keybindingService.sequenceTimeoutMs);
    manager.set({ ...sequenceState, timeoutHandle: handle });
  }
}
