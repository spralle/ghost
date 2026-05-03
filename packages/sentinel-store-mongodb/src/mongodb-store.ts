import type { Collection, Db } from 'mongodb';
import type {
  RelationTuple,
  StoredPolicyRule,
  SentinelWriteStore,
  PolicyEffect,
} from '@ghost/sentinel';
import type { MongoSentinelStoreConfig, TupleDocument, PolicyDocument, RoleDocument } from './types';
import { COLLECTION_NAMES, INDEXES } from './collections';

const VALID_EFFECTS: readonly PolicyEffect[] = ["deny", "reject", "grant"];

function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertValidEffect(effect: string): asserts effect is PolicyEffect {
  if (!VALID_EFFECTS.includes(effect as PolicyEffect)) {
    throw new Error(`effect must be one of: ${VALID_EFFECTS.join(", ")}; got "${effect}"`);
  }
}

export class MongoSentinelStore implements SentinelWriteStore {
  private readonly db: Db;
  private readonly tenantId: string;
  private readonly prefix: string;
  private readonly tuples: Collection<TupleDocument>;
  private readonly policies: Collection<PolicyDocument>;
  private readonly roles: Collection<RoleDocument>;

  constructor(config: MongoSentinelStoreConfig) {
    this.db = config.db;
    this.tenantId = config.tenantId;
    this.prefix = config.collectionPrefix ?? 'sentinel_';
    this.tuples = this.db.collection<TupleDocument>(`${this.prefix}${COLLECTION_NAMES.tuples}`);
    this.policies = this.db.collection<PolicyDocument>(`${this.prefix}${COLLECTION_NAMES.policies}`);
    this.roles = this.db.collection<RoleDocument>(`${this.prefix}${COLLECTION_NAMES.roles}`);
  }

  async loadTuples(nodeType: string, nodeId: string, relation: string): Promise<RelationTuple[]> {
    return this.tuples
      .find(
        { tenantId: this.tenantId, nodeType, nodeId, relation },
        { projection: { _id: 0, tenantId: 0 } },
      )
      .toArray() as Promise<RelationTuple[]>;
  }

  async loadTuplesFrom(node: { readonly type: string; readonly id: string }): Promise<RelationTuple[]> {
    return this.tuples
      .find(
        { tenantId: this.tenantId, nodeType: node.type, nodeId: node.id },
        { projection: { _id: 0, tenantId: 0 } },
      )
      .toArray() as Promise<RelationTuple[]>;
  }

  async loadPolicies(resourceType: string): Promise<StoredPolicyRule[]> {
    return this.policies
      .find(
        { tenantId: this.tenantId, resourceType },
        { projection: { _id: 0, tenantId: 0 } },
      )
      .toArray() as Promise<StoredPolicyRule[]>;
  }

  async loadRoles(principalId: string): Promise<string[]> {
    const doc = await this.roles.findOne(
      { tenantId: this.tenantId, principalId },
      { projection: { _id: 0, tenantId: 0 } },
    );
    return doc ? [...doc.roles] : [];
  }

  async addTuple(tuple: Omit<TupleDocument, 'tenantId'>): Promise<this> {
    assertNonEmpty(tuple.nodeType, "nodeType");
    assertNonEmpty(tuple.nodeId, "nodeId");
    assertNonEmpty(tuple.relation, "relation");
    assertNonEmpty(tuple.targetType, "targetType");
    assertNonEmpty(tuple.targetId, "targetId");
    await this.tuples.insertOne({ ...tuple, tenantId: this.tenantId });
    return this;
  }

  async addTuples(tuples: readonly Omit<TupleDocument, 'tenantId'>[]): Promise<this> {
    if (tuples.length > 0) {
      await this.tuples.insertMany(tuples.map((t) => ({ ...t, tenantId: this.tenantId })));
    }
    return this;
  }

  async removeTuple(tuple: Omit<TupleDocument, 'tenantId'>): Promise<this> {
    await this.tuples.deleteOne({
      tenantId: this.tenantId,
      nodeType: tuple.nodeType,
      nodeId: tuple.nodeId,
      relation: tuple.relation,
      targetType: tuple.targetType,
      targetId: tuple.targetId,
    });
    return this;
  }

  async addPolicy(policy: Omit<PolicyDocument, 'tenantId'>): Promise<this> {
    assertNonEmpty(policy.resourceType, "resourceType");
    assertNonEmpty(policy.action, "action");
    assertValidEffect(policy.effect);
    await this.policies.insertOne({ ...policy, tenantId: this.tenantId });
    return this;
  }

  async addPolicies(policies: readonly Omit<PolicyDocument, 'tenantId'>[]): Promise<this> {
    if (policies.length > 0) {
      await this.policies.insertMany(policies.map((p) => ({ ...p, tenantId: this.tenantId })));
    }
    return this;
  }

  async removePolicy(resourceType: string, action: string): Promise<this> {
    await this.policies.deleteOne({ tenantId: this.tenantId, resourceType, action });
    return this;
  }

  async setRoles(principalId: string, roles: readonly string[]): Promise<this> {
    assertNonEmpty(principalId, "principalId");
    await this.roles.updateOne(
      { tenantId: this.tenantId, principalId },
      { $set: { tenantId: this.tenantId, principalId, roles: [...roles] } },
      { upsert: true },
    );
    return this;
  }

  async removeRoles(principalId: string): Promise<this> {
    await this.roles.deleteOne({ tenantId: this.tenantId, principalId });
    return this;
  }

  async ensureIndexes(): Promise<void> {
    for (const idx of INDEXES.tuples) {
      await this.tuples.createIndex(idx.key, { name: idx.name });
    }
    for (const idx of INDEXES.policies) {
      await this.policies.createIndex(idx.key, { name: idx.name });
    }
    for (const idx of INDEXES.roles) {
      await this.roles.createIndex(idx.key, { name: idx.name, unique: idx.unique });
    }
  }

  async clear(): Promise<void> {
    await this.tuples.deleteMany({ tenantId: this.tenantId });
    await this.policies.deleteMany({ tenantId: this.tenantId });
    await this.roles.deleteMany({ tenantId: this.tenantId });
  }
}
