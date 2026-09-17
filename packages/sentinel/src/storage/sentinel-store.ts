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
  readonly effect?: "deny" | "reject" | "grant";
  readonly salience?: number;
}

/** Untrusted policy record returned by a storage adapter. */
export interface StoredPolicyRecord {
  readonly resourceType: unknown;
  readonly action: unknown;
  readonly condition: unknown;
  readonly effect?: unknown;
  readonly salience?: unknown;
}

/** Flat tuple returned from storage (no nested objects) */
export interface StoreTuple {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

/** Minimal read interface for Sentinel storage — shape only, no implementation */
export interface SentinelStore {
  loadTuples(nodeType: string, nodeId: string, relation: string): Promise<RelationTuple[]>;
  /** Load all tuples originating from a node (all relations) */
  loadTuplesFrom(node: { readonly type: string; readonly id: string }): Promise<StoreTuple[]>;
  loadPolicies(resourceType: string): Promise<StoredPolicyRecord[]>;
  loadRoles(principalId: string): Promise<string[]>;
}
