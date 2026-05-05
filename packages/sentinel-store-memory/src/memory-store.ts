import type {
  RelationTuple,
  SentinelStore,
  StoredPolicyRule,
} from "@sentinel-guard/core";

/** Re-export-compatible tuple shape for loadTuplesFrom */
interface StoreTuple {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

/**
 * In-memory implementation of SentinelStore for testing and development.
 * Uses plain arrays and Maps for fast lookup without external dependencies.
 */
export class MemorySentinelStore implements SentinelStore {
  private readonly tuples: RelationTuple[] = [];
  private readonly policies: Map<string, StoredPolicyRule[]> = new Map();
  private readonly roles: Map<string, string[]> = new Map();

  addTuple(tuple: RelationTuple): this {
    this.tuples.push(tuple);
    return this;
  }

  addTuples(tuples: readonly RelationTuple[]): this {
    for (const tuple of tuples) {
      this.tuples.push(tuple);
    }
    return this;
  }

  addPolicy(policy: StoredPolicyRule): this {
    const existing = this.policies.get(policy.resourceType);
    if (existing) {
      existing.push(policy);
    } else {
      this.policies.set(policy.resourceType, [policy]);
    }
    return this;
  }

  addPolicies(policies: readonly StoredPolicyRule[]): this {
    for (const policy of policies) {
      this.addPolicy(policy);
    }
    return this;
  }

  setRoles(principalId: string, roles: readonly string[]): this {
    this.roles.set(principalId, [...roles]);
    return this;
  }

  async loadTuples(
    nodeType: string,
    nodeId: string,
    relation: string,
  ): Promise<RelationTuple[]> {
    return this.tuples.filter(
      (t) =>
        t.nodeType === nodeType &&
        t.nodeId === nodeId &&
        t.relation === relation,
    );
  }

  async loadTuplesFrom(node: {
    readonly type: string;
    readonly id: string;
  }): Promise<StoreTuple[]> {
    return this.tuples.filter(
      (t) => t.nodeType === node.type && t.nodeId === node.id,
    );
  }

  async loadPolicies(resourceType: string): Promise<StoredPolicyRule[]> {
    return this.policies.get(resourceType) ?? [];
  }

  async loadRoles(principalId: string): Promise<string[]> {
    return this.roles.get(principalId) ?? [];
  }

  clear(): void {
    this.tuples.length = 0;
    this.policies.clear();
    this.roles.clear();
  }
}
