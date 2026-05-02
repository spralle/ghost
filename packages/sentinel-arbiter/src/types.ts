/**
 * Bridge-specific types for sentinel-arbiter integration.
 * Sentinel policy types are defined here until @ghost/sentinel is available as a workspace package.
 */

// ---------------------------------------------------------------------------
// Sentinel policy types (mirrored from sentinel-core design)
// ---------------------------------------------------------------------------

export type PolicyEffect = "deny" | "reject" | "grant";

export type PolicyTarget =
  | { readonly kind: "action"; readonly action: string }
  | { readonly kind: "dataBlock"; readonly block: string };

export interface PolicyRule {
  readonly name: string;
  readonly effect: PolicyEffect;
  readonly target: PolicyTarget;
  readonly condition: Record<string, unknown>;
  readonly salience?: number | undefined;
  readonly description?: string | undefined;
}

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

export interface EvalContext {
  readonly principal: {
    readonly userId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
    readonly partyIds: readonly string[];
    readonly orgChain: readonly string[];
  };
  readonly resource: Record<string, unknown>;
  readonly graph: {
    hasRelation(relation: string, targetType: string, targetId: string): boolean;
  };
  readonly action: string;
}

export const SALIENCE: Readonly<Record<PolicyEffect, number>> = {
  deny: 100,
  reject: 50,
  grant: 10,
} as const;

// ---------------------------------------------------------------------------
// Bridge types
// ---------------------------------------------------------------------------

export interface PolicyDecision {
  readonly effect: "allow" | "deny";
  readonly matchedRules: readonly CompiledRule[];
  readonly reason: string;
}

export interface SentinelSessionOptions {
  readonly activationGroup?: string | undefined;
}
