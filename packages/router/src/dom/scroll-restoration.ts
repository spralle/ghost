import type { ScrollPersistence } from "./scroll-persistence.js";

/** Stored scroll position for a navigation entry. */
export interface ScrollPosition {
  readonly x: number;
  readonly y: number;
}

/** Scroll positions for a navigation entry (window + registered containers). */
export interface ScrollSnapshot {
  readonly window: ScrollPosition;
  readonly containers: ReadonlyMap<string, ScrollPosition>;
}

/** Options for the scroll restoration manager. */
export interface ScrollRestorationOptions {
  /** Whether to scroll to top on new navigations. Default: true. */
  readonly scrollToTopOnNew?: boolean;
  /** Optional persistence backend. When provided, snapshots hydrate on init and flush on pagehide/dispose. */
  readonly persistence?: ScrollPersistence;
  /** Max entries before oldest-25% pruning. Default: 500. Only applies when persistence is set. */
  readonly maxEntries?: number;
}

/** A registered scrollable container. */
interface RegisteredContainer {
  readonly key: string;
  readonly element: Element;
}

/** Create a scroll restoration manager. */
export function createScrollRestoration(options: ScrollRestorationOptions = {}) {
  const scrollToTopOnNew = options.scrollToTopOnNew ?? true;
  const persistence = options.persistence;
  const maxEntries = options.maxEntries ?? 500;
  const snapshots = new Map<string, ScrollSnapshot>();
  const containers: RegisteredContainer[] = [];

  // Hydrate from persistence
  if (persistence) {
    for (const [key, snapshot] of persistence.load()) {
      snapshots.set(key, snapshot);
    }
  }

  // Disable browser's auto-restore
  if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  /** Flush snapshots to persistence backend. */
  function flush(): void {
    if (persistence) persistence.persist(snapshots);
  }

  /** Prune oldest 25% of entries when over capacity. */
  function maybePrune(): void {
    if (!persistence || snapshots.size <= maxEntries) return;
    const deleteCount = Math.floor(snapshots.size * 0.25);
    let removed = 0;
    for (const key of snapshots.keys()) {
      if (removed >= deleteCount) break;
      snapshots.delete(key);
      removed++;
    }
    flush();
  }

  // Pagehide listener for flushing on tab close
  const pagehideHandler = persistence && typeof window !== "undefined"
    ? () => { flush(); }
    : undefined;

  if (pagehideHandler) {
    window.addEventListener("pagehide", pagehideHandler);
  }

  /** Capture current scroll positions. */
  function capture(): ScrollSnapshot {
    const containerMap = new Map<string, ScrollPosition>();
    for (const c of containers) {
      containerMap.set(c.key, { x: c.element.scrollLeft, y: c.element.scrollTop });
    }
    return {
      window: { x: window.scrollX, y: window.scrollY },
      containers: containerMap,
    };
  }

  /** Save scroll positions for a navigation key. */
  function save(navigationKey: string): void {
    snapshots.set(navigationKey, capture());
    maybePrune();
  }

  /** Restore scroll positions for a navigation key. Returns true if restored. */
  function restore(navigationKey: string): boolean {
    const snapshot = snapshots.get(navigationKey);
    if (!snapshot) return false;

    requestAnimationFrame(() => {
      window.scrollTo(snapshot.window.x, snapshot.window.y);
      for (const c of containers) {
        const pos = snapshot.containers.get(c.key);
        if (pos) c.element.scrollTo(pos.x, pos.y);
      }
    });
    return true;
  }

  /** Scroll to top (for new navigations). */
  function scrollToTop(): void {
    if (!scrollToTopOnNew) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      for (const c of containers) {
        c.element.scrollTo(0, 0);
      }
    });
  }

  /** Register a scrollable container element. Returns dispose function. */
  function registerContainer(key: string, element: Element): () => void {
    const entry: RegisteredContainer = { key, element };
    containers.push(entry);
    return () => {
      const idx = containers.indexOf(entry);
      if (idx !== -1) containers.splice(idx, 1);
    };
  }

  /** Remove all entries matching a key prefix and flush. */
  function removeByPrefix(prefix: string): void {
    for (const key of [...snapshots.keys()]) {
      if (key.startsWith(prefix)) snapshots.delete(key);
    }
    flush();
  }

  /** Handle a navigation event. */
  function onNavigate(event: { prevKey?: string; nextKey: string; isBack: boolean }): void {
    if (event.prevKey) save(event.prevKey);

    if (event.isBack) {
      restore(event.nextKey);
    } else {
      scrollToTop();
    }
  }

  /** Dispose — restore browser's default scroll behavior. */
  function dispose(): void {
    flush();
    snapshots.clear();
    containers.length = 0;
    if (pagehideHandler) {
      window.removeEventListener("pagehide", pagehideHandler);
    }
    persistence?.dispose?.();
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "auto";
    }
  }

  return { save, restore, scrollToTop, registerContainer, onNavigate, dispose, flush, removeByPrefix };
}
