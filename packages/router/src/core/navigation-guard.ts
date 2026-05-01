import type { NavigationHints, NavigationTarget } from "./types.js";

/** Context available to navigation guards. */
export interface NavigationGuardContext {
  readonly source: "user" | "programmatic" | "popstate";
  readonly currentRoute: string | null;
}

/** Result of a navigation guard check. */
export type NavigationGuardResult =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string; readonly redirect?: NavigationTarget };

/** A navigation guard that can approve or reject navigation. */
export interface NavigationGuard {
  /** Unique guard ID for debugging. */
  readonly id: string;
  /** Check if navigation should proceed. */
  canNavigate(
    target: NavigationTarget,
    hints: NavigationHints | undefined,
    context: NavigationGuardContext,
  ): NavigationGuardResult | Promise<NavigationGuardResult>;
}

/** Registry for navigation guards. */
export interface NavigationGuardRegistry {
  /** Add a guard. Returns dispose function. */
  addGuard(guard: NavigationGuard): () => void;
  /** Run all guards in registration order. First rejection wins. */
  runGuards(
    target: NavigationTarget,
    hints: NavigationHints | undefined,
    context: NavigationGuardContext,
  ): Promise<NavigationGuardResult>;
}

/** Create a guard registry with ordered pipeline execution. */
export function createNavigationGuardRegistry(): NavigationGuardRegistry {
  const guards: NavigationGuard[] = [];

  return {
    addGuard(guard) {
      guards.push(guard);
      return () => {
        const idx = guards.indexOf(guard);
        if (idx !== -1) guards.splice(idx, 1);
      };
    },
    async runGuards(target, hints, context) {
      for (const guard of guards) {
        const result = await guard.canNavigate(target, hints, context);
        if (!result.allow) return result;
      }
      return { allow: true };
    },
  };
}
