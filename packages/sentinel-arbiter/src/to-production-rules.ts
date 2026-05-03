/**
 * Converts sentinel CompiledRule[] into arbiter ProductionRule[].
 * Each sentinel rule becomes an arbiter production rule with:
 * - when: merged target filter + condition
 * - then: sets decision state
 * - salience: passed through for conflict resolution
 * - activationGroup: ensures mutual exclusion (only highest-salience fires)
 */

import type { ProductionRule } from "@ghost-shell/arbiter";
import type { CompiledRule } from "./types";

const DEFAULT_ACTIVATION_GROUP = "sentinel-decision";

/**
 * Builds the `when` clause by merging target filter with the rule's condition.
 * Action targets match on `ctx.action`, dataBlock targets match on `ctx.resource.block`.
 */
function buildWhenClause(rule: CompiledRule): Record<string, unknown> {
  const targetFilter =
    rule.target.kind === "action" ? { "ctx.action": rule.target.action } : { "ctx.resource.block": rule.target.block };

  const prefixedCondition: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rule.condition)) {
    prefixedCondition[`ctx.${key}`] = value;
  }

  // Guard: only fire if no decision has been made yet (ensures highest-salience wins)
  const guard = { "decision.effect": { $exists: false } };

  return { ...guard, ...targetFilter, ...prefixedCondition };
}

/**
 * Builds the `then` stages that record the decision in session state.
 */
function buildThenStages(rule: CompiledRule): readonly Record<string, unknown>[] {
  return [
    {
      $set: {
        "decision.effect": rule.effect,
        "decision.ruleName": rule.name,
      },
    },
  ];
}

/**
 * Converts an array of sentinel CompiledRules into arbiter ProductionRules.
 * All rules share an activation group so only the highest-salience match fires.
 */
export function toProductionRules(
  rules: readonly CompiledRule[],
  activationGroup: string = DEFAULT_ACTIVATION_GROUP,
): readonly ProductionRule[] {
  return rules.map(
    (rule): ProductionRule => ({
      name: rule.name,
      when: buildWhenClause(rule),
      // biome-ignore lint/suspicious/noThenProperty: arbiter ProductionRule requires `then`
      then: buildThenStages(rule),
      salience: rule.salience,
      activationGroup,
    }),
  );
}
