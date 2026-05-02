export { resolvePrincipal } from "./principal-resolver.js";
export { createSnapshotManager } from "./snapshot-manager.js";
export { buildBatch } from "./batch-builder.js";
export { createQueryDecoratorFactory } from "./query-decorator.js";
export { createRedactionHook } from "./redaction-middleware.js";
export { createInvalidationProcessor } from "./invalidation.js";

export type {
  AccountsJwtPayload,
  EnrichedJwtPayload,
  PrincipalResolverOptions,
  SnapshotCache,
  SnapshotManagerConfig,
  SnapshotManager,
  BatchBuildOptions,
  BatchBuildResult,
  RedactionContext,
  RedactionHook,
  ViewDbQueryDecorator,
  QueryDecoratorConfig,
  QueryDecoratorFactory,
  InvalidationEventType,
  InvalidationEvent,
  InvalidationHandler,
  InvalidationProcessorConfig,
  InvalidationProcessor,
} from "./types.js";
