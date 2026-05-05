import type { FormState } from "./state.js";
import { deepFreeze } from "./utils.js";

/** Pluggable clone/freeze strategy for state isolation. */
export interface StateStrategy {
  readonly clone: <T>(value: T) => T;
  readonly freeze: <T>(value: T) => T;
}

export const defaultStrategy: StateStrategy = {
  clone: <T>(value: T): T => structuredClone(value),
  freeze: deepFreeze,
};

/** Read-only view of a transaction's state at a point in time. */
export interface TransactionSnapshot<TData, TUi> {
  readonly prevState: FormState<TData, TUi>;
  readonly draftState: FormState<TData, TUi>;
  readonly status: "active" | "committed" | "rolled-back";
}

/** Mutable draft context that tracks mutations against a frozen baseline. */
export class Transaction<TData, TUi> {
  private _prevState: FormState<TData, TUi>;
  private _draftState: FormState<TData, TUi>;
  private _status: "active" | "committed" | "rolled-back" = "active";
  private _dirty = false;

  constructor(currentState: FormState<TData, TUi>, strategy: StateStrategy = defaultStrategy) {
    this._prevState = strategy.freeze(strategy.clone(currentState));
    this._draftState = strategy.clone(currentState);
  }

  get prevState(): FormState<TData, TUi> {
    return this._prevState;
  }

  get draftState(): FormState<TData, TUi> {
    return this._draftState;
  }

  get status(): "active" | "committed" | "rolled-back" {
    return this._status;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  /** Apply a mutation to the draft state */
  mutate(mutator: (draft: FormState<TData, TUi>) => FormState<TData, TUi>): void {
    if (this._status !== "active") {
      throw new Error(`Cannot mutate ${this._status} transaction`);
    }
    this._draftState = mutator(this._draftState);
    this._dirty = true;
  }

  /** Commit — returns the final draft state */
  commit(): FormState<TData, TUi> {
    if (this._status !== "active") {
      throw new Error(`Cannot commit ${this._status} transaction`);
    }
    this._status = "committed";
    return this._draftState;
  }

  /** Rollback — discard all draft mutations, return original state */
  rollback(): FormState<TData, TUi> {
    if (this._status !== "active") {
      throw new Error(`Cannot rollback ${this._status} transaction`);
    }
    this._status = "rolled-back";
    return this._prevState;
  }
}
