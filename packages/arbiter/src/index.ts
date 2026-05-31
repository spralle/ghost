// Public types — rule definitions
// Public types — session configuration
// Public types — session API
// Public types — results & diagnostics
export type {
  ArbiterWarning,
  FiringResult,
  OperatorFunction,
  OperatorRegistryConfig,
  ProductionRule,
  RuleSession,
  SessionConfig,
  SessionLimits,
  StateChange,
  SubscriptionCallback,
  ThenOperatorHandler,
  ThenOperatorRegistry,
  ThenStage,
  ThenValue,
  TmsConfig,
  Unsubscribe,
  WriteRecord,
} from "./contracts.js";

// Error types
export { ArbiterError, ArbiterErrorCode } from "./errors.js";

// Session factory
export { createSession } from "./session.js";

// Clock abstraction
export type { ArbiterClock, VirtualClock } from "./clock.js";
export { createRealClock, createVirtualClock } from "./clock.js";

// Fact support
export type { Fact, FactMemory } from "./fact-memory.js";
export type { FactFieldType, FactRegistry, FactTypeDefinition } from "./fact-registry.js";

// Accumulate support
export type { AccumulateConfig, AccumulateNode } from "./accumulate-node.js";
export type { AccumulateManager } from "./accumulate-manager.js";
export type { AccumulateFn, CustomAccumulateFunction } from "./accumulate-functions.js";
export type { WindowedAccumulateConfig, WindowedAccumulateNode } from "./windowed-accumulate.js";
export { createWindowedAccumulateNode } from "./windowed-accumulate.js";
export type { CompiledPattern, FactPattern } from "./fact-pattern.js";

// Beta/Join network
export type { BetaNode, Token } from "./beta-node.js";
export { createBetaNode } from "./beta-node.js";
export type { JoinConstraint, JoinNode, JoinNodeConfig } from "./join-node.js";
export { createJoinNode } from "./join-node.js";

// Temporal operators
export { createTemporalOperators, TEMPORAL_OPERATORS } from "./temporal-operators.js";

// Beta network compilation
export type { AlphaFilterNode, BetaNetwork } from "./beta-network.js";
export { compileBetaNetwork } from "./beta-network.js";

// Beta evaluator
export type { BetaEvaluator, FactActivation, FactDeactivation } from "./beta-evaluator.js";
export { createBetaEvaluator } from "./beta-evaluator.js";

// Timer queue
export type { ScheduleOptions, TimerEntry, TimerQueue } from "./timer-queue.js";
export { createTimerQueue } from "./timer-queue.js";

// Expiry tracker
export type { ExpiryTracker } from "./expiry-tracker.js";
export { createExpiryTracker } from "./expiry-tracker.js";

// Cross-type accumulation
export type { CrossTypeAccumulator } from "./cross-type-accumulate.js";
export { createCrossTypeAccumulator } from "./cross-type-accumulate.js";
