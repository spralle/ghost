import type { ScrollPosition, ScrollSnapshot } from "./scroll-restoration.js";

/** Pluggable persistence backend for scroll snapshots. */
export interface ScrollPersistence {
  /** Load all persisted scroll entries. Returns a Map of navigationKey → ScrollSnapshot. */
  readonly load: () => Map<string, ScrollSnapshot>;
  /** Persist the full snapshot map (full-replace, write-behind). */
  readonly persist: (entries: ReadonlyMap<string, ScrollSnapshot>) => void;
  /** Optional cleanup hook. */
  readonly dispose?: () => void;
}

/** Options for the sessionStorage-backed scroll persistence adapter. */
export interface SessionScrollPersistenceOptions {
  /** sessionStorage key. Default: "ghost-scroll-v1" */
  readonly storageKey?: string;
}

interface SerializedSnapshot {
  readonly window: ScrollPosition;
  readonly containers: ReadonlyArray<readonly [string, ScrollPosition]>;
}

function serializeSnapshots(
  entries: ReadonlyMap<string, ScrollSnapshot>,
): Record<string, SerializedSnapshot> {
  const result: Record<string, SerializedSnapshot> = {};
  for (const [key, snapshot] of entries) {
    result[key] = {
      window: snapshot.window,
      containers: Array.from(snapshot.containers.entries()),
    };
  }
  return result;
}

function deserializeSnapshots(
  raw: Record<string, SerializedSnapshot>,
): Map<string, ScrollSnapshot> {
  const map = new Map<string, ScrollSnapshot>();
  for (const [key, serialized] of Object.entries(raw)) {
    map.set(key, {
      window: serialized.window,
      containers: new Map(serialized.containers),
    });
  }
  return map;
}

/** Create a sessionStorage-backed scroll persistence adapter. */
export function createSessionScrollPersistence(
  options: SessionScrollPersistenceOptions = {},
): ScrollPersistence {
  const storageKey = options.storageKey ?? "ghost-scroll-v1";

  function load(): Map<string, ScrollSnapshot> {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return new Map();
      return deserializeSnapshots(JSON.parse(raw) as Record<string, SerializedSnapshot>);
    } catch {
      sessionStorage.removeItem(storageKey);
      return new Map();
    }
  }

  function persist(entries: ReadonlyMap<string, ScrollSnapshot>): void {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(serializeSnapshots(entries)));
    } catch {
      // Silently swallow QuotaExceededError or other storage errors
    }
  }

  function dispose(): void {
    // No-op for sessionStorage
  }

  return { load, persist, dispose };
}
