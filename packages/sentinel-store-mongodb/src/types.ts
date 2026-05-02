import type { Db } from 'mongodb';

export interface MongoSentinelStoreConfig {
  readonly db: Db;
  readonly collectionPrefix?: string;
}

export interface TupleDocument {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

export interface PolicyDocument {
  readonly resourceType: string;
  readonly action: string;
  readonly condition: unknown;
}

export interface RoleDocument {
  readonly principalId: string;
  readonly roles: readonly string[];
}
