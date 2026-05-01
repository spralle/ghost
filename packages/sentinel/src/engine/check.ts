import type { CompiledPolicy } from "../policy/compile-policy.js";
import type { EvalContext } from "../policy/policy-types.js";
import { evaluatePolicy } from "../policy/evaluate-policy.js";
import type { GraphSubset } from "../graph/graph-subset.js";
import { createNode } from "../graph/relation-node.js";
import type { SentinelPrincipal } from "../principal/sentinel-principal.js";

export interface CheckContext {
  readonly policy: CompiledPolicy;
  readonly graphSubset: GraphSubset;
  readonly resource: Record<string, unknown>;
}

export interface CheckResult {
  readonly effect: "allow" | "deny";
  readonly matchedRules: readonly { name: string; effect: string; salience: number }[];
  readonly reason: string;
}

/** Build EvalContext from principal, resource, and graph subset */
function buildEvalContext(
  principal: SentinelPrincipal,
  action: string,
  context: CheckContext,
): EvalContext {
  const principalNode = createNode("user", principal.userId);

  return {
    principal: {
      userId: principal.userId,
      tenantId: principal.tenantId,
      roles: principal.roles,
      partyIds: principal.partyIds,
      orgChain: principal.orgChain,
    },
    resource: context.resource,
    graph: {
      hasRelation(relation: string, targetType: string, targetId: string): boolean {
        const targets = context.graphSubset.resolve(principalNode, relation);
        return targets.some((t) => t.type === targetType && t.id === targetId);
      },
    },
    action,
  };
}

/** Check if a principal can perform an action on a resource */
export function check(
  principal: SentinelPrincipal,
  action: string,
  context: CheckContext,
): CheckResult {
  const evalContext = buildEvalContext(principal, action, context);
  const decision = evaluatePolicy(context.policy, action, evalContext);

  return {
    effect: decision.effect,
    matchedRules: decision.matchedRules.map((r) => ({
      name: r.name,
      effect: r.effect,
      salience: r.salience,
    })),
    reason: decision.reason,
  };
}
