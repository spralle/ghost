/**
 * High-level evaluation: asserts context into session, fires, and returns PolicyDecision.
 */

import type { RuleSession } from "@ghost-shell/arbiter";
import { createSentinelSession } from "./create-sentinel-session";
import type { CompiledPolicy, EvalContext, PolicyDecision } from "./types";

/**
 * Asserts the EvalContext into the session state under the "ctx" prefix.
 */
function assertContext(session: RuleSession, context: EvalContext): void {
  session.assert("ctx.action", context.action);
  session.assert("ctx.principal", context.principal);
  session.assert("ctx.resource", context.resource);
  session.assert("ctx.principal.userId", context.principal.userId);
  session.assert("ctx.principal.tenantId", context.principal.tenantId);
  session.assert("ctx.principal.roles", context.principal.roles);
  session.assert("ctx.principal.partyIds", context.principal.partyIds);
  session.assert("ctx.principal.orgChain", context.principal.orgChain);
}

/**
 * Reads the decision from session state after firing.
 */
function readDecision(session: RuleSession, policy: CompiledPolicy): PolicyDecision {
  const rawEffect = session.getPath("decision.effect");
  const rawRuleName = session.getPath("decision.ruleName");
  const effect = typeof rawEffect === "string" ? rawEffect : undefined;
  const ruleName = typeof rawRuleName === "string" ? rawRuleName : undefined;

  if (!effect || !ruleName) {
    return {
      effect: "deny",
      matchedRules: [],
      reason: "No matching policy rule — default deny",
    };
  }

  const matchedRule = policy.rules.find((r) => r.name === ruleName);
  const policyEffect = effect === "grant" ? "allow" : "deny";
  const reason = policyEffect === "deny" ? `Denied by rule: ${ruleName}` : `Granted by rule: ${ruleName}`;

  return {
    effect: policyEffect,
    matchedRules: matchedRule ? [matchedRule] : [],
    reason,
  };
}

/**
 * Evaluates a sentinel policy against an action and context using arbiter's rule engine.
 * Creates a fresh session, asserts context, fires rules, and returns the decision.
 */
export function evaluate(policy: CompiledPolicy, context: EvalContext): PolicyDecision {
  const session = createSentinelSession(policy);
  try {
    assertContext(session, context);
    session.fire();
    return readDecision(session, policy);
  } finally {
    session.dispose();
  }
}

/**
 * Evaluates using an existing session — useful for batch evaluation or session reuse.
 * Caller is responsible for session lifecycle.
 */
export function evaluateWithSession(session: RuleSession, policy: CompiledPolicy, context: EvalContext): PolicyDecision {
  assertContext(session, context);
  session.fire();
  return readDecision(session, policy);
}
