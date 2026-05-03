/**
 * Re-exports sentinel core policy types and defines bridge-specific types.
 */

// Re-export all policy types from sentinel core
export type {
  CompiledPolicy,
  CompiledRule,
  EvalContext,
  PolicyDecision,
  PolicyEffect,
  PolicyRule,
  PolicyTarget,
} from "@ghost/sentinel";

export { SALIENCE } from "@ghost/sentinel";

// ---------------------------------------------------------------------------
// Bridge types
// ---------------------------------------------------------------------------

export interface SentinelSessionOptions {
  readonly activationGroup?: string | undefined;
}
