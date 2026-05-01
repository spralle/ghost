import type { NavigationHints, NavigationResult, NavigationTarget } from "./types.js";

/** Source of the navigation event. */
export type NavigationSource = "user-click" | "programmatic" | "popstate" | "delegated";

/** Structured navigation event. */
export interface NavigationEvent {
  readonly type: "navigation_start" | "navigation_complete" | "navigation_error" | "navigation_cancelled";
  readonly timestamp: number;
  readonly source: NavigationSource;
  /** Sanitized target — IDs only, no sensitive args. */
  readonly target: SanitizedTarget;
  readonly hints?: NavigationHints;
  /** Duration in ms (only on complete/error). */
  readonly durationMs?: number;
  /** Navigation result (only on complete). */
  readonly result?: NavigationResult;
  /** Error message (only on error). */
  readonly error?: string;
}

/** Sanitized navigation target — strips arg values for privacy. */
export interface SanitizedTarget {
  readonly type: "route" | "intent";
  readonly id: string;
  /** Number of args/facts (not values). */
  readonly argCount: number;
}

/** Sink that receives navigation events. */
export interface NavigationEventSink {
  readonly id: string;
  onEvent(event: NavigationEvent): void;
}

/** Observer that dispatches events to registered sinks. */
export interface NavigationObserver {
  /** Register a sink. Returns dispose function. */
  addSink(sink: NavigationEventSink): () => void;
  /** Emit a navigation event to all sinks. Fire-and-forget. */
  emit(event: NavigationEvent): void;
}

/** Sanitize a NavigationTarget — strip values, keep IDs. */
export function sanitizeTarget(target: NavigationTarget): SanitizedTarget {
  if ("route" in target) {
    return { type: "route", id: target.route, argCount: Object.keys(target.params).length };
  }
  return { type: "intent", id: target.intent, argCount: Object.keys(target.facts).length };
}

/** Create a navigation observer with pluggable sinks. */
export function createNavigationObserver(): NavigationObserver {
  const sinks: NavigationEventSink[] = [];

  return {
    addSink(sink) {
      sinks.push(sink);
      return () => {
        const idx = sinks.indexOf(sink);
        if (idx !== -1) sinks.splice(idx, 1);
      };
    },
    emit(event) {
      for (const sink of sinks) {
        try {
          sink.onEvent(event);
        } catch {
          /* fire-and-forget */
        }
      }
    },
  };
}

/** Create a console sink for dev mode. */
export function createConsoleNavigationSink(): NavigationEventSink {
  return {
    id: "console",
    onEvent(event) {
      const prefix = `[nav:${event.type}]`;
      const target = `${event.target.type}:${event.target.id}`;
      const duration = event.durationMs ? ` (${event.durationMs}ms)` : "";
      console.debug(`${prefix} ${target}${duration}`, event.source);
    },
  };
}
