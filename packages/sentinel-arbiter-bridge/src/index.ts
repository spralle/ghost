export { createSentinelSession } from "./create-sentinel-session.js";
export { evaluate, evaluateWithSession } from "./evaluate.js";
export { toProductionRules } from "./to-production-rules.js";
export type {
  CompiledPolicy,
  CompiledRule,
  EvalContext,
  PolicyDecision,
  PolicyEffect,
  PolicyRule,
  PolicyTarget,
  SentinelSessionOptions,
} from "./types.js";
export { SALIENCE } from "./types.js";
