import { proxyMap, proxySet } from "valtio/utils";
import { proxy, snapshot, subscribe, unstable_enableOp } from "valtio/vanilla";

export { proxyMap, proxySet };

/** Operation produced by valtio's subscribe callback. */
export type StateOp = [op: string, path: (string | symbol)[], value: unknown, prevValue?: unknown];

/** Subscription callback for state changes. */
export type StateSubscriber = (ops: StateOp[]) => void;

interface ManagedState<S extends object> {
  readonly proxy: S;
  readonly subscribers: Set<StateSubscriber>;
  readonly unsubscribe: () => void;
}

const managedStates = new Map<object, ManagedState<object>>();

// Enable op tracking so subscribe receives mutation details
unstable_enableOp();

/**
 * Creates a framework-managed reactive state object.
 * The returned proxy can be mutated freely; the framework detects mutations
 * and can replicate ops to popout windows via scomp feeds.
 */
export function createState<S extends object>(initial: S): S {
  const state = proxy(initial);
  const subscribers = new Set<StateSubscriber>();

  const unsubscribe = subscribe(state, (ops) => {
    for (const sub of subscribers) {
      sub(ops as StateOp[]);
    }
  });

  managedStates.set(state, { proxy: state, subscribers, unsubscribe } as ManagedState<object>);
  return state;
}

/** Subscribe to ops on a managed state proxy. Returns an unsubscribe function. */
export function subscribeState(state: object, callback: StateSubscriber): () => void {
  const managed = managedStates.get(state);
  if (!managed) {
    throw new Error("subscribeState called on a non-managed state object. Use createState() first.");
  }
  managed.subscribers.add(callback);
  return () => {
    managed.subscribers.delete(callback);
  };
}

/** Get an immutable snapshot of the current state. */
export function getStateSnapshot<S extends object>(state: S): S {
  return snapshot(state) as S;
}

/** Check if an object is a framework-managed state proxy. */
export function isManagedState(obj: unknown): boolean {
  return managedStates.has(obj as object);
}

/** Dispose a managed state — unsubscribes and removes from registry. */
export function disposeState(state: object): void {
  const managed = managedStates.get(state);
  if (managed) {
    managed.unsubscribe();
    managed.subscribers.clear();
    managedStates.delete(state);
  }
}
