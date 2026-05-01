// Primary API

// Types
export type { EvaluationScope, ExpressionDefinition, ExprNode } from "./ast.js";
// Collections
export { type FindOptions, find } from "./collection/find.js";
export { findOne } from "./collection/find-one.js";
// Compilation
// Backward compatibility
export { compile, compileShorthand, type Query, type ShorthandQuery } from "./compile.js";
export { PredicateError, type PredicateErrorCode } from "./errors.js";
// Evaluation (thin facade)
export { clearRegexCache, type EvaluateOptions, evaluate, getRegexCacheSize } from "./evaluator.js";
// Diagnostics
export { type EvaluateWithTraceResult, evaluateWithTrace, type PredicateFailureTrace } from "./failure-trace.js";
export {
  type CompileFilterOptions,
  clearRegexCache as clearFilterRegexCache,
  compileFilter,
  compileFilterFromAst,
  compileRawFromAst,
  type FilterFn,
  getRegexCacheSize as getFilterRegexCacheSize,
} from "./filter-compiler.js";
// Extensibility
export {
  type CustomOperatorEntry,
  type CustomOperatorFn,
  type OperatorDefinition,
  OperatorRegistry,
} from "./operators.js";

// Path utilities
export {
  assertComparableTypes,
  collectArrayLeaves,
  collectPath,
  normalizeComparable,
  PATH_MISSING,
  resolvePath,
  resolveSegments,
  validateAndSplitPath,
} from "./path-utils.js";
export { Predicate, type PredicateOptions } from "./predicate.js";
// Safety
export { assertSafeSegment, DANGEROUS_KEYS } from "./safe-path.js";

// Sort utilities
export { applySorting, compareValues } from "./sort-utils.js";
export type { CustomFieldOps, DotPaths, FieldCondition, PathValue, TypedQuery, UntypedQuery } from "./typed-query.js";
