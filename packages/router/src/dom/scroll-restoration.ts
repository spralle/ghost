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
}

/** A registered scrollable container. */
interface RegisteredContainer {
  readonly key: string;
  readonly element: Element;
}

/** Create a scroll restoration manager. */
export function createScrollRestoration(options: ScrollRestorationOptions = {}) {
  const scrollToTopOnNew = options.scrollToTopOnNew ?? true;
  const snapshots = new Map<string, ScrollSnapshot>();
  const containers: RegisteredContainer[] = [];

  // Disable browser's auto-restore
  if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
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
    snapshots.clear();
    containers.length = 0;
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "auto";
    }
  }

  return { save, restore, scrollToTop, registerContainer, onNavigate, dispose };
}
