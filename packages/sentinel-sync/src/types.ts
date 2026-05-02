import type {
  SentinelPrincipal,
  PermissionSnapshot,
  SentinelStore,
  ResourceSchema,
} from "@ghost/sentinel";

/** Current JWT payload from accounts service */
export interface AccountsJwtPayload {
  readonly id: string;
  readonly tenant: string;
  readonly roles?: readonly string[];
  readonly source: string;
  readonly name: string;
  readonly surname: string;
  readonly emails: readonly string[];
  readonly isOnlineOnly?: boolean;
  readonly type?: string;
  readonly impersonatedBy?: {
    readonly userId: string;
    readonly expires: number;
    readonly originalToken: string;
  };
}

/** Future enriched JWT (superset) */
export interface EnrichedJwtPayload extends AccountsJwtPayload {
  readonly sub?: string;
  readonly partyIds?: readonly string[];
  readonly orgChain?: readonly string[];
  readonly exp?: number;
  readonly iat?: number;
}

export interface PrincipalResolverOptions {
  readonly store: SentinelStore;
  readonly trustJwtPartyIds?: boolean;
}

export interface SnapshotCache {
  get(principalId: string): PermissionSnapshot | undefined;
  set(principalId: string, snapshot: PermissionSnapshot): void;
  delete(principalId: string): void;
  clear(): void;
}

export interface SnapshotManagerConfig {
  readonly store: SentinelStore;
  readonly resourceTypes: readonly string[];
  readonly cache?: SnapshotCache;
  readonly serialize?: (snapshot: PermissionSnapshot) => string;
}

export interface SnapshotManager {
  build(principal: SentinelPrincipal): Promise<PermissionSnapshot>;
  get(principalId: string): PermissionSnapshot | undefined;
  invalidate(principalId: string): void;
  invalidateByTenant(tenantId: string): void;
  serialize(snapshot: PermissionSnapshot): string;
}

export interface BatchBuildOptions {
  readonly store: SentinelStore;
  readonly resourceTypes: readonly string[];
  readonly concurrency?: number;
}

export interface BatchBuildResult {
  readonly snapshots: ReadonlyMap<string, PermissionSnapshot>;
  readonly errors: ReadonlyMap<string, Error>;
}

export interface RedactionContext {
  readonly grantedBlocks: readonly string[];
}

export type RedactionHook<T extends Record<string, unknown> = Record<string, unknown>> = (
  documents: readonly T[],
  schema: ResourceSchema<unknown, string>,
  context: RedactionContext
) => Partial<T>[];

/** viewdb queryDecorator signature */
export type ViewDbQueryDecorator = (
  collection: string,
  query: object,
  callback: (decoratedQuery: object) => void
) => void;

export interface QueryDecoratorConfig {
  readonly collectionSchemaMap: Readonly<Record<string, ResourceSchema<unknown, string>>>;
  readonly defaultRelation?: string;
  readonly relationOverrides?: Readonly<Record<string, string>>;
}

export type QueryDecoratorFactory = (
  principalPartyIds: readonly string[]
) => ViewDbQueryDecorator;

export type InvalidationEventType =
  | "role_assigned"
  | "role_revoked"
  | "party_relationship_changed"
  | "policy_updated"
  | "org_structure_changed";

export interface InvalidationEvent {
  readonly type: InvalidationEventType;
  readonly tenantId: string;
  readonly affectedPrincipalIds: readonly string[];
  readonly timestamp: number;
}

export interface InvalidationHandler {
  onInvalidate(principalIds: readonly string[]): void;
}

export interface InvalidationProcessorConfig {
  readonly snapshotManager: SnapshotManager;
  readonly handler: InvalidationHandler;
  readonly debounceMs?: number;
}

export interface InvalidationProcessor {
  process(event: InvalidationEvent): void;
  flush(): void;
}
