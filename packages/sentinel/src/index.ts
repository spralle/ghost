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
