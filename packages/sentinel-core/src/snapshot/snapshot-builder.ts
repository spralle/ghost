import type { SentinelStore } from "../storage/sentinel-store.js";
import type { SentinelPrincipal } from "../principal/sentinel-principal.js";
import type { PermissionSnapshot } from "./permission-snapshot.js";
import { compilePolicyRules } from "../policy/compile-policy.js";
import { buildCone } from "../graph/cone-builder.js";
import { createNode } from "../graph/relation-node.js";
import { getTtlForRoles } from "./snapshot-validator.js";
import type { CompiledRule } from "../policy/compile-policy.js";

export interface SnapshotBuilderOptions {
  readonly maxGraphDepth?: number; // default 5
  readonly maxGraphNodes?: number; // default 500
  readonly customTtls?: Readonly<Record<string, number>>;
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
      policyRules.map((r) => ({
        name: `${resourceType}:${r.action}`,
        effect: "grant" as const,
        target: { kind: "action" as const, action: r.action },
        condition: r.condition as Record<string, unknown>,
      })),
    );
    allRules.push(...compiled.rules);
  }

  const principalNode = createNode("principal", principal.userId);
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
    compiledPolicy: Object.freeze({ rules: Object.freeze(allRules) }),
    graphCone,
    redactionMap: Object.freeze(redactionMap),
    timestamp: Date.now(),
    ttl,
  });

  return snapshot;
}
