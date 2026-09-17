export const KEYBINDING_MODIFIER_ORDER = ["ctrl", "shift", "alt", "meta"] as const;

export type KeybindingModifier = (typeof KEYBINDING_MODIFIER_ORDER)[number];

const KEYBOARD_EVENT_MODIFIERS = new Set(["shift", "control", "alt", "meta"]);
const KEYBINDING_MODIFIERS = new Set<KeybindingModifier>(KEYBINDING_MODIFIER_ORDER);

export interface NormalizedKeybindingChord {
  modifiers: KeybindingModifier[];
  key: string;
  value: string;
}

export function normalizeKeyboardEventChord(event: KeyboardEvent): NormalizedKeybindingChord | null {
  const key = event.key.toLowerCase();
  if (!key || KEYBOARD_EVENT_MODIFIERS.has(key)) {
    return null;
  }

  const modifiers: KeybindingModifier[] = [];
  if (event.ctrlKey) {
    modifiers.push("ctrl");
  }
  if (event.shiftKey) {
    modifiers.push("shift");
  }
  if (event.altKey) {
    modifiers.push("alt");
  }
  if (event.metaKey) {
    modifiers.push("meta");
  }

  return toNormalizedChord(modifiers, key);
}

export function normalizeConfiguredChord(input: string): NormalizedKeybindingChord | null {
  const parts = input
    .toLowerCase()
    .split("+")
    .map((part) => part.trim());

  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    return null;
  }

  const modifiers = new Set<KeybindingModifier>();
  let key: string | null = null;
  for (const part of parts) {
    if (isKeybindingModifier(part)) {
      modifiers.add(part);
      continue;
    }

    if (key !== null) {
      return null;
    }

    key = part;
  }

  if (!key) {
    return null;
  }

  return toNormalizedChord([...modifiers], key);
}

function toNormalizedChord(modifiers: KeybindingModifier[], key: string): NormalizedKeybindingChord {
  const orderedModifiers = KEYBINDING_MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
  return {
    modifiers: orderedModifiers,
    key,
    value: [...orderedModifiers, key].join("+"),
  };
}

function isKeybindingModifier(value: string): value is KeybindingModifier {
  return KEYBINDING_MODIFIERS.has(value as KeybindingModifier);
}

/** A sequence of one or more chords. Single-chord keybindings produce a sequence of length 1. */
export interface NormalizedKeybindingSequence {
  chords: NormalizedKeybindingChord[];
  /** Canonical string: chord values joined by " " (space) */
  value: string;
}

/**
 * Parse a space-separated sequence of chords.
 * Each space-separated token is parsed via normalizeConfiguredChord().
 * Returns null if input is empty or a token is invalid.
 */
export function normalizeConfiguredSequence(input: string): NormalizedKeybindingSequence | null {
  const collapsed = input.trim().replace(/\s*\+\s*/g, "+");
  const tokens = collapsed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return null;
  }

  const chords: NormalizedKeybindingChord[] = [];
  for (const token of tokens) {
    const chord = normalizeConfiguredChord(token);
    if (chord === null) {
      return null;
    }
    chords.push(chord);
  }

  return {
    chords,
    value: chords.map((c) => c.value).join(" "),
  };
}
