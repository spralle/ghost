/** The three policy effects, ordered by salience */
export type PolicyEffect = "deny" | "reject" | "grant";

/** What a policy rule targets */
export type PolicyTarget =
  | { readonly kind: "action"; readonly action: string }
  | { readonly kind: "dataBlock"; readonly block: string };

/** A single policy rule */
export interface PolicyRule {
  readonly name: string;
  readonly effect: PolicyEffect;
  readonly target: PolicyTarget;
  readonly condition: Record<string, unknown>;
  readonly salience?: number;
  readonly description?: string;
}

/** Evaluation context assembled at check time */
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
    /** Check if principal has a relation to a target node */
    hasRelation(relation: string, targetType: string, targetId: string): boolean;
  };
  readonly action: string;
}

/** Salience constants for automatic ordering */
export const SALIENCE = {
  deny: 100,
  reject: 50,
  grant: 10,
} as const;
