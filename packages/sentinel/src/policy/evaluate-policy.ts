import { compileFilter } from "kuery";

import type { CompiledPolicy, CompiledRule } from "./compile-policy.js";
import type { EvalContext } from "./policy-types.js";

export interface PolicyDecision {
  readonly effect: "allow" | "deny";
  readonly matchedRules: readonly CompiledRule[];
  readonly reason: string;
}

/** Check if a rule targets the given action */
function targetsAction(rule: CompiledRule, action: string): boolean {
  if (rule.target.kind === "action") {
    return rule.target.action === action;
  }
  return false;
}

/** Evaluate a rule's condition against the eval context */
function matchesCondition(
  condition: Record<string, unknown>,
  context: EvalContext,
): boolean {
  if (Object.keys(condition).length === 0) {
    return true;
  }
  const filterFn = compileFilter(condition);
  return filterFn(context as unknown as Record<string, unknown>);
}

/** Evaluate compiled policy against an action and eval context */
export function evaluatePolicy(
  policy: CompiledPolicy,
  action: string,
  context: EvalContext,
): PolicyDecision {
  const matchedRules: CompiledRule[] = [];

  for (const rule of policy.rules) {
    if (!targetsAction(rule, action)) {
      continue;
    }
    if (matchesCondition(rule.condition, context)) {
      matchedRules.push(rule);
    }
  }

  if (matchedRules.length === 0) {
    return { effect: "deny", matchedRules: [], reason: "No matching rules; default deny" };
  }

  // Rules are already sorted by salience descending; highest wins
  const winner = matchedRules[0];

  if (winner.effect === "grant") {
    return { effect: "allow", matchedRules, reason: `Granted by rule: ${winner.name}` };
  }

  return { effect: "deny", matchedRules, reason: `Denied by rule: ${winner.name}` };
}
