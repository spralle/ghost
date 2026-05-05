import type { FiringResult, ProductionRule, RuleSession } from "@ghost-shell/arbiter";
import { createSession } from "@ghost-shell/arbiter";
import type { RuleWriteIntent } from "./contracts.js";
import { isArbiterInternalPath } from "./expression-integration.js";
import type { FormState } from "./state.js";

export interface ArbiterFormAdapter {
  readonly session: RuleSession;
  readonly syncAndFire: (state: FormState<unknown, unknown>) => readonly RuleWriteIntent[];
  readonly dispose: () => void;
}

/**
 * Sync FormState into arbiter session scope, fire, and return writes.
 * Form data fields go to root namespace. $ui fields go to $ui namespace.
 */
function syncAndFireImpl(session: RuleSession, state: FormState<unknown, unknown>): readonly RuleWriteIntent[] {
  const data = (state.data ?? {}) as Readonly<Record<string, unknown>>;
  const uiState = (state.uiState ?? {}) as Readonly<Record<string, unknown>>;

  // Sync form data → session root scope
  for (const [key, value] of Object.entries(data)) {
    session.assert(key, value);
  }

  // Sync $ui → session $ui namespace
  for (const [key, value] of Object.entries(uiState)) {
    session.assert(`$ui.${key}`, value);
  }

  const result: FiringResult = session.fire();

  // Convert FiringResult.changes → RuleWriteIntent[], filtering arbiter-internal paths
  return result.changes
    .filter((change) => !isArbiterInternalPath(change.path))
    .map((change) => ({
      path: change.path,
      value: change.newValue,
      mode: (change.newValue === undefined ? "delete" : "set") as "set" | "delete",
      ruleId: change.ruleName,
    }));
}

/** Create adapter from ProductionRule[] — creates internal session */
export function createArbiterAdapter(
  rules: readonly ProductionRule[],
  initialData?: Readonly<Record<string, unknown>>,
): ArbiterFormAdapter {
  const session = createSession({
    rules,
    initialState: initialData as Record<string, unknown> | undefined,
  });

  return {
    session,
    syncAndFire: (state: FormState<unknown, unknown>) => syncAndFireImpl(session, state),
    dispose: () => session.dispose(),
  };
}

/** Create adapter from pre-configured RuleSession */
export function createArbiterAdapterFromSession(session: RuleSession): ArbiterFormAdapter {
  return {
    session,
    syncAndFire: (state: FormState<unknown, unknown>) => syncAndFireImpl(session, state),
    dispose: () => session.dispose(),
  };
}
