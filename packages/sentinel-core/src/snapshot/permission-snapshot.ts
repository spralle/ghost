import type { CompiledPolicy } from "../policy/compile-policy.js";
import type { GraphSubset } from "../graph/graph-subset.js";

/** Pre-compiled offline permission bundle */
export interface PermissionSnapshot {
  readonly principalId: string;
  readonly tenantId: string;
  readonly resolvedRoles: readonly string[];
  readonly compiledPolicy: CompiledPolicy;
  readonly graphCone: GraphSubset;
  readonly redactionMap: Readonly<Record<string, readonly string[]>>; // blockName -> granted fields
  readonly timestamp: number; // epoch ms
  readonly ttl: number; // ms until expiry
}
