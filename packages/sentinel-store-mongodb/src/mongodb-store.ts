import type { Collection, Db } from 'mongodb';
import type { MongoSentinelStoreConfig, TupleDocument, PolicyDocument, RoleDocument } from './types';
import { COLLECTION_NAMES, INDEXES } from './collections';

interface RelationTuple {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

interface PolicyRule {
  readonly resourceType: string;
  readonly action: string;
  readonly condition: unknown;
}

interface SentinelStore {
  loadTuples(nodeType: string, nodeId: string, relation: string): Promise<RelationTuple[]>;
  loadTuplesFrom(node: { readonly type: string; readonly id: string }): Promise<RelationTuple[]>;
  loadPolicies(resourceType: string): Promise<PolicyRule[]>;
  loadRoles(principalId: string): Promise<string[]>;
}

export class MongoSentinelStore implements SentinelStore {
  private readonly db: Db;
  private readonly prefix: string;
  private readonly tuples: Collection<TupleDocument>;
  private readonly policies: Collection<PolicyDocument>;
  private readonly roles: Collection<RoleDocument>;

  constructor(config: MongoSentinelStoreConfig) {
    this.db = config.db;
    this.prefix = config.collectionPrefix ?? 'sentinel_';
    this.tuples = this.db.collection<TupleDocument>(`${this.prefix}${COLLECTION_NAMES.tuples}`);
    this.policies = this.db.collection<PolicyDocument>(`${this.prefix}${COLLECTION_NAMES.policies}`);
    this.roles = this.db.collection<RoleDocument>(`${this.prefix}${COLLECTION_NAMES.roles}`);
  }

  async loadTuples(nodeType: string, nodeId: string, relation: string): Promise<RelationTuple[]> {
    return this.tuples
      .find({ nodeType, nodeId, relation }, { projection: { _id: 0 } })
      .toArray() as Promise<RelationTuple[]>;
  }

  async loadTuplesFrom(node: { readonly type: string; readonly id: string }): Promise<RelationTuple[]> {
    return this.tuples
      .find({ nodeType: node.type, nodeId: node.id }, { projection: { _id: 0 } })
      .toArray() as Promise<RelationTuple[]>;
  }

  async loadPolicies(resourceType: string): Promise<PolicyRule[]> {
    return this.policies
      .find({ resourceType }, { projection: { _id: 0 } })
      .toArray() as Promise<PolicyRule[]>;
  }

  async loadRoles(principalId: string): Promise<string[]> {
    const doc = await this.roles.findOne({ principalId }, { projection: { _id: 0 } });
    return doc ? [...doc.roles] : [];
  }

  async addTuple(tuple: TupleDocument): Promise<this> {
    await this.tuples.insertOne({ ...tuple });
    return this;
  }

  async addTuples(tuples: readonly TupleDocument[]): Promise<this> {
    if (tuples.length > 0) {
      await this.tuples.insertMany(tuples.map((t) => ({ ...t })));
    }
    return this;
  }

  async removeTuple(tuple: TupleDocument): Promise<this> {
    await this.tuples.deleteOne({
      nodeType: tuple.nodeType,
      nodeId: tuple.nodeId,
      relation: tuple.relation,
      targetType: tuple.targetType,
      targetId: tuple.targetId,
    });
    return this;
  }

  async addPolicy(policy: PolicyDocument): Promise<this> {
    await this.policies.insertOne({ ...policy });
    return this;
  }

  async addPolicies(policies: readonly PolicyDocument[]): Promise<this> {
    if (policies.length > 0) {
      await this.policies.insertMany(policies.map((p) => ({ ...p })));
    }
    return this;
  }

  async removePolicy(resourceType: string, action: string): Promise<this> {
    await this.policies.deleteOne({ resourceType, action });
    return this;
  }

  async setRoles(principalId: string, roles: readonly string[]): Promise<this> {
    await this.roles.updateOne(
      { principalId },
      { $set: { principalId, roles: [...roles] } },
      { upsert: true },
    );
    return this;
  }

  async removeRoles(principalId: string): Promise<this> {
    await this.roles.deleteOne({ principalId });
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
    await this.tuples.deleteMany({});
    await this.policies.deleteMany({});
    await this.roles.deleteMany({});
  }
}
