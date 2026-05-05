/**
 * Creates a pre-loaded arbiter RuleSession configured for sentinel policy evaluation.
 */

import type { RuleSession } from "@ghost-shell/arbiter";
import { createSession } from "@ghost-shell/arbiter";
import { toProductionRules } from "./to-production-rules.js";
import type { CompiledPolicy, SentinelSessionOptions } from "./types.js";

/**
 * Creates an arbiter session pre-loaded with sentinel policy rules.
 * The session is ready to receive context assertions and fire for decisions.
 */
export function createSentinelSession(policy: CompiledPolicy, options?: SentinelSessionOptions): RuleSession {
  const activationGroup = options?.activationGroup ?? "sentinel-decision";
  const productionRules = toProductionRules(policy.rules, activationGroup);

  return createSession({
    rules: productionRules,
    validation: "strict",
  });
}
