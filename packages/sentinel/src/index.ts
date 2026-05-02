export {
  defineResourceSchema,
  type ArrayObjectKeys,
  type AudienceOverride,
  type DataBlockConfig,
  type ElementOf,
  type FilteredRelation,
  type RecursiveRelation,
  type ResourceSchema,
  type ResourceSchemaConfig,
  type SelfRefKeys,
  type SensitivityTier,
  type TypedRelation,
} from "./schema/index.js";

export type {
  PolicyRule as StoredPolicyRule,
  RelationTuple,
  SentinelStore,
} from "./storage/sentinel-store.js";

export {
  compilePolicyRules,
  definePolicy,
  evaluatePolicy,
  SALIENCE,
  type CompiledPolicy,
  type CompiledRule,
  type EvalContext,
  type Policy,
  type PolicyConfig,
  type PolicyDecision,
  type PolicyEffect,
  type PolicyRule,
  type PolicyTarget,
} from "./policy/index.js";


export {
  createNode,
  createTuple,
  GraphSubset,
  buildCone,
  nodeKey,
  type RelationNode,
  type RelationTuple as GraphRelationTuple,
  type ConeOptions,
} from "./graph/index.js";

export {
  createPrincipal,
  impersonate,
  isImpersonated,
  type SentinelPrincipal,
  type ImpersonatedPrincipal,
} from "./principal/index.js";

export {
  buildSnapshot,
  isExpired,
  needsRefresh,
  getTtlForRoles,
  DEFAULT_ROLE_TTLS,
  type PermissionSnapshot,
  type SnapshotBuilderOptions,
} from "./snapshot/index.js";

export {
  check,
  can,
  filterQuery,
  redact,
  expand,
  type CheckContext,
  type CheckResult,
  type RedactContext,
  type DerivationNode,
} from "./engine/index.js";
