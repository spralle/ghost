import type { NavigationTarget } from "./types.js";
import type { NavigationError } from "./navigation-error.js";

/** A strategy that can handle specific navigation errors and suggest recovery targets. */
export interface ErrorRecoveryStrategy {
  readonly id: string;
  canHandle(error: NavigationError): boolean;
  recover(error: NavigationError): NavigationTarget | null;
}

/** Registry that manages recovery strategies and attempts recovery in priority order. */
export interface ErrorRecoveryRegistry {
  addStrategy(strategy: ErrorRecoveryStrategy): () => void;
  tryRecover(error: NavigationError): NavigationTarget | null;
}

/**
 * Creates an error recovery registry.
 * Strategies are tried in insertion order; first successful recovery wins.
 */
export function createErrorRecoveryRegistry(): ErrorRecoveryRegistry {
  const strategies: ErrorRecoveryStrategy[] = [];

  return {
    addStrategy(strategy: ErrorRecoveryStrategy): () => void {
      strategies.push(strategy);
      return () => {
        const idx = strategies.indexOf(strategy);
        if (idx !== -1) strategies.splice(idx, 1);
      };
    },

    tryRecover(error: NavigationError): NavigationTarget | null {
      for (const strategy of strategies) {
        if (strategy.canHandle(error)) {
          const target = strategy.recover(error);
          if (target) return target;
        }
      }
      return null;
    },
  };
}
