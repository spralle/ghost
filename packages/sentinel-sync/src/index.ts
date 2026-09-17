export { buildBatch } from "./batch-builder.js";
export { createInvalidationProcessor } from "./invalidation.js";
export { resolvePrincipal } from "./principal-resolver.js";
export { createQueryDecoratorFactory } from "./query-decorator.js";
export { createRedactionHook } from "./redaction-middleware.js";
export { createSnapshotManager } from "./snapshot-manager.js";

export type {
  AccountsJwtPayload,
  BatchBuildOptions,
  BatchBuildResult,
  EnrichedJwtPayload,
  InvalidationEvent,
  InvalidationEventType,
  InvalidationHandler,
  InvalidationProcessor,
  InvalidationProcessorConfig,
  PrincipalResolverOptions,
  QueryDecoratorConfig,
  QueryDecoratorFactory,
  RedactionContext,
  RedactionHook,
  SnapshotCache,
  SnapshotManager,
  SnapshotManagerConfig,
  ViewDbQueryDecorator,
} from "./types.js";
