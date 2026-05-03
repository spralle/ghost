import type { Db } from 'mongodb';
import type { PolicyEffect } from '@ghost/sentinel';

export interface MongoSentinelStoreConfig {
  readonly db: Db;
  readonly tenantId: string;
  readonly collectionPrefix?: string;
}

export interface TupleDocument {
  readonly tenantId: string;
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

export interface PolicyDocument {
  readonly tenantId: string;
  readonly resourceType: string;
  readonly action: string;
  readonly condition: unknown;
  readonly effect: PolicyEffect;
  readonly salience?: number;
  readonly targetKind?: "action" | "dataBlock";
  readonly block?: string;
}

export interface RoleDocument {
  readonly tenantId: string;
  readonly principalId: string;
  readonly roles: readonly string[];
}
