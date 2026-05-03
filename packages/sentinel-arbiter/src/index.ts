export { createSentinelSession } from "./create-sentinel-session";
export { evaluate, evaluateWithSession } from "./evaluate";
export { toProductionRules } from "./to-production-rules";
export type {
  CompiledPolicy,
  CompiledRule,
  EvalContext,
  PolicyDecision,
  PolicyEffect,
  PolicyRule,
  PolicyTarget,
  SentinelSessionOptions,
} from "./types";
export { SALIENCE } from "./types";
