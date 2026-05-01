import type { ContextToken, Disposable } from "@ghost-shell/contracts";
import { createState, disposeState, getStateSnapshot, isManagedState, subscribeState } from "./reactive-state.js";

export interface ContextCreateResult<T extends object> {
  readonly state: T;
  dispose(): void;
}

/**
 * Create a valtio-backed reactive context from a typed token.
 * Wraps init in a managed proxy (unless already managed), validates against
 * the token's schema, and registers as a contribution via the provided contribute fn.
 */
export function createContextForToken<T extends object>(
  token: ContextToken<T>,
  init: T,
  contribute: (contribution: { id: string; get(): unknown; subscribe(listener: () => void): Disposable }) => Disposable,
): ContextCreateResult<T> {
  const isExistingProxy = isManagedState(init);
  const state = isExistingProxy ? init : createState(init);

  if (token.schema) {
    const result = token.schema.safeParse(init);
    if (!result.success) {
      // Clean up if we created the proxy
      if (!isExistingProxy) disposeState(state);
      throw new Error(`Context "${token.id}" init failed validation: ${result.error.message}`);
    }
  }

  const disposable = contribute({
    id: token.id,
    get: () => getStateSnapshot(state),
    subscribe: (listener: () => void) => {
      const unsub = subscribeState(state, () => listener());
      return { dispose: unsub };
    },
  });

  return {
    state,
    dispose() {
      disposable.dispose();
      if (!isExistingProxy) {
        disposeState(state);
      }
    },
  };
}
