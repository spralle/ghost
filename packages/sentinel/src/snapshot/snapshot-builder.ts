import { buildCone } from "../graph/cone-builder.js";
import { createNode } from "../graph/relation-node.js";
import { compilePolicyRules } from "../policy/compile-policy.js";
import type { PolicyEffect, PolicyRule } from "../policy/policy-types.js";
import type { SentinelPrincipal } from "../principal/sentinel-principal.js";
import type { SentinelStore, StoredPolicyRecord } from "../storage/sentinel-store.js";
import type { PermissionSnapshot } from "./permission-snapshot.js";
import { getTtlForRoles } from "./snapshot-validator.js";
import { isStoredCondition } from "./stored-condition.js";

export interface SnapshotBuilderOptions {
  readonly maxGraphDepth?: number; // default 5
  readonly maxGraphNodes?: number; // default 500
  readonly customTtls?: Readonly<Record<string, number>>;
}

export type SnapshotBuildErrorCode =
  | "invalid-action"
  | "invalid-condition"
  | "invalid-effect"
  | "invalid-resource-type"
  | "invalid-salience";

export class SnapshotBuildError extends Error {
  readonly code: SnapshotBuildErrorCode;

  constructor(code: SnapshotBuildErrorCode, resourceType: string, ruleIndex: number) {
    super(`Invalid stored policy (${code}) for resource type "${resourceType}" at index ${ruleIndex}.`);
    this.name = "SnapshotBuildError";
    this.code = code;
  }
}

/** Build a PermissionSnapshot for a principal. Runs on server. */
export async function buildSnapshot(
  store: SentinelStore,
  principal: SentinelPrincipal,
  resourceTypes: readonly string[],
  options?: SnapshotBuilderOptions,
): Promise<PermissionSnapshot> {
  const roles = await store.loadRoles(principal.userId);

  const allRules: PolicyRule[] = [];
  for (const resourceType of resourceTypes) {
    const policyRules = await store.loadPolicies(resourceType);
    allRules.push(...policyRules.map((rule, index) => normalizeStoredRule(rule, resourceType, index)));
  }
  const compiledPolicy = compilePolicyRules(allRules);

  const principalNode = createNode("user", principal.userId);
  const coneOptions = {
    ...(options?.maxGraphDepth !== undefined && { maxDepth: options.maxGraphDepth }),
    ...(options?.maxGraphNodes !== undefined && { maxNodes: options.maxGraphNodes }),
  };
  const graphCone = await buildCone(store, principalNode, coneOptions);

  const redactionMap: Record<string, readonly string[]> = {};

  const ttl = getTtlForRoles(roles, options?.customTtls);

  const snapshot: PermissionSnapshot = Object.freeze({
    principalId: principal.userId,
    tenantId: principal.tenantId,
    resolvedRoles: Object.freeze([...roles]),
    compiledPolicy,
    graphCone,
    redactionMap: Object.freeze(redactionMap),
    timestamp: Date.now(),
    ttl,
  });

  return snapshot;
}

function normalizeStoredRule(rule: StoredPolicyRecord, resourceType: string, ruleIndex: number): PolicyRule {
  if (rule.resourceType !== resourceType) {
    throw new SnapshotBuildError("invalid-resource-type", resourceType, ruleIndex);
  }
  if (typeof rule.action !== "string" || rule.action.trim().length === 0) {
    throw new SnapshotBuildError("invalid-action", resourceType, ruleIndex);
  }
  if (!isStoredCondition(rule.condition)) {
    throw new SnapshotBuildError("invalid-condition", resourceType, ruleIndex);
  }
  const effect = normalizeEffect(rule.effect, resourceType, ruleIndex);
  const salience = normalizeSalience(rule.salience, resourceType, ruleIndex);
  return {
    name: `${resourceType}:${rule.action}`,
    effect,
    target: { kind: "action", action: rule.action },
    condition: scopeCondition(rule.condition, resourceType),
    ...(salience !== undefined && { salience }),
  };
}

function normalizeEffect(value: unknown, resourceType: string, ruleIndex: number): PolicyEffect {
  if (value === undefined) return "grant";
  if (value === "deny" || value === "reject" || value === "grant") return value;
  throw new SnapshotBuildError("invalid-effect", resourceType, ruleIndex);
}

function normalizeSalience(value: unknown, resourceType: string, ruleIndex: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new SnapshotBuildError("invalid-salience", resourceType, ruleIndex);
}

function scopeCondition(condition: Record<string, unknown>, resourceType: string): Record<string, unknown> {
  const resourceConstraint = { "resource.type": { $eq: resourceType } };
  return Object.keys(condition).length === 0 ? resourceConstraint : { $and: [condition, resourceConstraint] };
}
