export {
  type CheckContext,
  type CheckResult,
  can,
  check,
  type DerivationNode,
  expand,
  filterQuery,
  type RedactContext,
  redact,
} from "./engine/index.js";
export {
  buildCone,
  type ConeOptions,
  createNode,
  createTuple,
  GraphSubset,
  nodeKey,
  type RelationNode,
  type RelationTuple as GraphRelationTuple,
} from "./graph/index.js";

export {
  type CompiledPolicy,
  type CompiledRule,
  compilePolicyRules,
  definePolicy,
  type EvalContext,
  evaluatePolicy,
  type Policy,
  type PolicyConfig,
  type PolicyDecision,
  type PolicyEffect,
  type PolicyRule,
  type PolicyTarget,
  SALIENCE,
} from "./policy/index.js";
export {
  createPrincipal,
  type ImpersonatedPrincipal,
  impersonate,
  isImpersonated,
  type SentinelPrincipal,
} from "./principal/index.js";
export {
  type ArrayObjectKeys,
  type AudienceOverride,
  type DataBlockConfig,
  defineResourceSchema,
  type ElementOf,
  type FilteredRelation,
  type RecursiveRelation,
  type ResourceSchema,
  type ResourceSchemaConfig,
  type SelfRefKeys,
  type SensitivityTier,
  type TypedRelation,
} from "./schema/index.js";

export {
  buildSnapshot,
  DEFAULT_ROLE_TTLS,
  getTtlForRoles,
  isExpired,
  isStoredCondition,
  needsRefresh,
  normalizeStoredCondition,
  type PermissionSnapshot,
  SnapshotBuildError,
  type SnapshotBuildErrorCode,
  type SnapshotBuilderOptions,
  STORED_CONDITION_COMPILE_NODE_BUDGET,
  type StoredConditionComplexity,
  type StoredConditionNormalization,
} from "./snapshot/index.js";
export type {
  PolicyRule as StoredPolicyRule,
  RelationTuple,
  SentinelStore,
} from "./storage/sentinel-store.js";
