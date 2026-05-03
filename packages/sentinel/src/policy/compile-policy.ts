import type { PolicyEffect, PolicyRule, PolicyTarget } from "./policy-types";
import { SALIENCE } from "./policy-types";

export interface CompiledRule {
  readonly name: string;
  readonly effect: PolicyEffect;
  readonly target: PolicyTarget;
  readonly condition: Record<string, unknown>;
  readonly salience: number;
}

export interface CompiledPolicy {
  readonly rules: readonly CompiledRule[];
}

/** Resolve the effective salience for a rule */
function resolveSalience(rule: PolicyRule): number {
  if (rule.salience !== undefined) {
    return rule.salience;
  }
  return SALIENCE[rule.effect];
}

/** Compile PolicyRules into arbiter-compatible production rules with salience ordering */
export function compilePolicyRules(rules: readonly PolicyRule[]): CompiledPolicy {
  const compiled: CompiledRule[] = rules.map((rule) => ({
    name: rule.name,
    effect: rule.effect,
    target: rule.target,
    condition: rule.condition,
    salience: resolveSalience(rule),
  }));

  compiled.sort((a, b) => b.salience - a.salience || a.name.localeCompare(b.name));

  return Object.freeze({ rules: Object.freeze(compiled) });
}
