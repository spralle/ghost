/** A stored relationship tuple between nodes */
export interface RelationTuple {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

/** A stored policy rule for a resource type */
export interface PolicyRule {
  readonly resourceType: string;
  readonly action: string;
  readonly condition: unknown;
}

/** Minimal read interface for Sentinel storage — shape only, no implementation */
export interface SentinelStore {
  loadTuples(nodeType: string, nodeId: string, relation: string): Promise<RelationTuple[]>;
  loadPolicies(resourceType: string): Promise<PolicyRule[]>;
  loadRoles(principalId: string): Promise<string[]>;
}
