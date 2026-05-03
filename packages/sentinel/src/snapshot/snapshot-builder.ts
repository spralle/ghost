import type { SentinelStore, PolicyRule as StoredPolicyRule } from "../storage/sentinel-store";
import type { SentinelPrincipal } from "../principal/sentinel-principal";
import type { PermissionSnapshot } from "./permission-snapshot";
import type { PolicyRule } from "../policy/policy-types";
import { SALIENCE } from "../policy/policy-types";
import { compilePolicyRules } from "../policy/compile-policy";
import { buildCone } from "../graph/cone-builder";
import { createNode } from "../graph/relation-node";
import { getTtlForRoles } from "./snapshot-validator";
import type { CompiledRule } from "../policy/compile-policy";

export interface SnapshotBuilderOptions {
  readonly maxGraphDepth?: number; // default 5
  readonly maxGraphNodes?: number; // default 500
  readonly customTtls?: Readonly<Record<string, number>>;
}

/** Convert a stored policy rule to the domain PolicyRule shape */
function toPolicyRule(resourceType: string, r: StoredPolicyRule): PolicyRule {
  const target =
    r.targetKind === "dataBlock" && r.block !== undefined
      ? ({ kind: "dataBlock" as const, block: r.block })
      : ({ kind: "action" as const, action: r.action });

  return {
    name: `${resourceType}:${r.action}`,
    effect: r.effect,
    target,
    condition: r.condition as Record<string, unknown>,
    ...(r.salience !== undefined && { salience: r.salience }),
  };
}

/** Collect granted data-block names per resource type from compiled rules */
function buildRedactionMap(
  compiledRules: readonly CompiledRule[],
): Record<string, readonly string[]> {
  const map: Record<string, string[]> = {};

  for (const rule of compiledRules) {
    if (rule.target.kind !== "dataBlock" || rule.effect !== "grant") {
      continue;
    }
    const blockName = rule.target.block;
    // rule.name is formatted as "resourceType:action"
    const resourceType = rule.name.split(":")[0];
    if (resourceType === undefined) {
      continue;
    }
    const existing = map[resourceType];
    if (existing) {
      existing.push(blockName);
    } else {
      map[resourceType] = [blockName];
    }
  }

  return map;
}

/** Build a PermissionSnapshot for a principal. Runs on server. */
export async function buildSnapshot(
  store: SentinelStore,
  principal: SentinelPrincipal,
  resourceTypes: readonly string[],
  options?: SnapshotBuilderOptions,
): Promise<PermissionSnapshot> {
  const roles = await store.loadRoles(principal.userId);

  const allRules: CompiledRule[] = [];
  for (const resourceType of resourceTypes) {
    const policyRules = await store.loadPolicies(resourceType);
    const compiled = compilePolicyRules(
      policyRules.map((r) => toPolicyRule(resourceType, r)),
    );
    allRules.push(...compiled.rules);
  }

  const principalNode = createNode("principal", principal.userId);
  const coneOptions = {
    ...(options?.maxGraphDepth !== undefined && { maxDepth: options.maxGraphDepth }),
    ...(options?.maxGraphNodes !== undefined && { maxNodes: options.maxGraphNodes }),
  };
  const graphCone = await buildCone(store, principalNode, coneOptions);

  const redactionMap = buildRedactionMap(allRules);

  const ttl = getTtlForRoles(roles, options?.customTtls);

  const snapshot: PermissionSnapshot = Object.freeze({
    principalId: principal.userId,
    tenantId: principal.tenantId,
    resolvedRoles: Object.freeze([...roles]),
    compiledPolicy: Object.freeze({ rules: Object.freeze(allRules) }),
    graphCone,
    redactionMap: Object.freeze(redactionMap),
    timestamp: Date.now(),
    ttl,
  });

  return snapshot;
}
