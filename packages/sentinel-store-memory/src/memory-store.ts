import type {
  RelationTuple,
  SentinelWriteStore,
  StoredPolicyRule,
  StoreTuple,
} from "@ghost/sentinel";

/**
 * In-memory implementation of SentinelWriteStore for testing and development.
 * Uses plain arrays and Maps for fast lookup without external dependencies.
 */
export class MemorySentinelStore implements SentinelWriteStore {
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

  removeTuple(tuple: RelationTuple): this {
    const idx = this.tuples.findIndex(
      (t) =>
        t.nodeType === tuple.nodeType &&
        t.nodeId === tuple.nodeId &&
        t.relation === tuple.relation &&
        t.targetType === tuple.targetType &&
        t.targetId === tuple.targetId,
    );
    if (idx >= 0) this.tuples.splice(idx, 1);
    return this;
  }

  removePolicy(resourceType: string, action: string): this {
    const existing = this.policies.get(resourceType);
    if (existing) {
      const filtered = existing.filter((p) => p.action !== action);
      if (filtered.length > 0) {
        this.policies.set(resourceType, filtered);
      } else {
        this.policies.delete(resourceType);
      }
    }
    return this;
  }

  removeRoles(principalId: string): this {
    this.roles.delete(principalId);
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
