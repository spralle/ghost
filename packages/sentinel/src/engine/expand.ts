import type { CheckContext } from "./check.js";
import { check } from "./check.js";
import type { SentinelPrincipal } from "../principal/sentinel-principal.js";

export interface DerivationNode {
  readonly type: "rule_match" | "graph_path" | "condition" | "decision";
  readonly description: string;
  readonly children?: readonly DerivationNode[];
  readonly metadata?: Record<string, unknown>;
}

/** Produce a derivation tree showing WHY access was granted/denied */
export function expand(
  principal: SentinelPrincipal,
  action: string,
  context: CheckContext,
): DerivationNode {
  const result = check(principal, action, context);

  const ruleChildren: DerivationNode[] = result.matchedRules.map((rule) => ({
    type: "rule_match" as const,
    description: `Rule "${rule.name}" (${rule.effect}, salience: ${rule.salience})`,
    metadata: { name: rule.name, effect: rule.effect, salience: rule.salience },
  }));

  const node: DerivationNode = ruleChildren.length > 0
    ? { type: "decision", description: `${result.effect}: ${result.reason}`, children: ruleChildren, metadata: { effect: result.effect, action } }
    : { type: "decision", description: `${result.effect}: ${result.reason}`, metadata: { effect: result.effect, action } };

  return node;
}
