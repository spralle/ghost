import { PredicateError } from "./errors.js";
import { assertSafeSegment } from "./safe-path.js";

/** Sentinel for missing path values — shared across evaluator and filter compiler. */
export const PATH_MISSING: unique symbol = Symbol("PATH_MISSING");

/** Validate all segments in a dotted path and return the split segments. */
export function validateAndSplitPath(path: string): readonly string[] {
  const segments = path.split(".");
  for (const seg of segments) assertSafeSegment(seg);
  return segments;
}

/** Normalize Date to epoch ms for comparison; pass through other values unchanged. */
export function normalizeComparable(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  return v;
}

/** Throw if operands are not both numbers or both strings (after Date normalization). */
export function assertComparableTypes(a: unknown, b: unknown, op: string): void {
  const na = normalizeComparable(a);
  const nb = normalizeComparable(b);
  const ta = typeof na;
  const tb = typeof nb;
  if (ta !== tb || (ta !== "number" && ta !== "string")) {
    throw new PredicateError(
      "FORMBAR_EXPR_TYPE_MISMATCH",
      `${op} requires operands of the same type (number or string), got ${ta} and ${tb}`,
    );
  }
}

/**
 * Collect all values reachable via a dotted path, descending into arrays.
 * For multi-segment paths, arrays encountered mid-traversal are iterated.
 */
export function collectPath(root: unknown, segments: readonly string[]): unknown {
  // Fast path: direct traversal with no array allocation
  let current: unknown = root;
  for (let i = 0; i < segments.length; i++) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      return collectPathSlow(root, segments);
    }
    current = (current as Record<string, unknown>)[segments[i]!];
  }
  return current;
}

function collectPathSlow(root: unknown, segments: readonly string[]): unknown {
  let targets: unknown[] = [root];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const next: unknown[] = [];
    for (const t of targets) {
      if (t === null || t === undefined || typeof t !== "object") continue;
      if (Array.isArray(t)) {
        for (const el of t) {
          if (el !== null && el !== undefined && typeof el === "object") {
            const v = (el as Record<string, unknown>)[seg];
            if (v !== undefined) next.push(v);
          }
        }
      } else {
        const v = (t as Record<string, unknown>)[seg];
        if (v !== undefined) next.push(v);
      }
    }
    targets = next;
  }
  if (targets.length === 0) return undefined;
  if (targets.length === 1) return targets[0];
  return targets;
}

/** Resolve pre-split segments against an object (no validation, no array traversal). */
export function resolveSegments(obj: unknown, segments: readonly string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Collect arrays found at the leaf of a dotted path (for $elemMatch).
 * Unlike collectPath, non-array leaf values are skipped — mirrors kuery's
 * `collect(key, lastPathMustBeArray=true)` behavior.
 */
export function collectArrayLeaves(root: unknown, segments: readonly string[]): unknown[][] {
  const results: unknown[][] = [];
  _collectArrayLeaves(results, root, segments, 0);
  return results;
}

function _collectArrayLeaves(results: unknown[][], current: unknown, segments: readonly string[], index: number): void {
  if (current === null || current === undefined || typeof current !== "object") return;
  if (Array.isArray(current)) {
    for (const el of current) {
      _collectArrayLeaves(results, el, segments, index);
    }
    return;
  }
  if (index >= segments.length) return;
  const val = (current as Record<string, unknown>)[segments[index]!];
  if (index === segments.length - 1) {
    // Leaf segment: only collect if it's an array
    if (Array.isArray(val)) results.push(val);
  } else if (val !== undefined) {
    _collectArrayLeaves(results, val, segments, index + 1);
  }
}

/** Resolve a dotted path against an object, with array traversal for multi-segment paths. */
export function resolvePath(path: string, scope: Record<string, unknown>): unknown {
  const segments = path.split(".");
  for (const seg of segments) assertSafeSegment(seg);
  if (segments.length === 1) {
    return scope[segments[0]!];
  }
  return collectPath(scope, segments);
}
