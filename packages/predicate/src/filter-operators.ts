import type { ExprNode } from "./ast.js";
import { PredicateError } from "./errors.js";
import type { OperatorRegistry } from "./operators.js";
import {
  assertComparableTypes,
  collectArrayLeaves,
  normalizeComparable,
  PATH_MISSING,
  validateAndSplitPath,
} from "./path-utils.js";
import { getCachedRegex } from "./regex-cache.js";

/** Boolean predicate closure (filter operators). */
export type BoolScopeFn = (scope: Record<string, unknown>) => boolean;
/** Value-resolving closure (paths, literals). */
export type ValScopeFn = (scope: Record<string, unknown>) => unknown;

// These are set by filter-compiler.ts to break the circular dependency
let _compileNode: (node: ExprNode, registry?: OperatorRegistry) => BoolScopeFn | ValScopeFn;
let _compilePathWithMissing: (node: ExprNode & { kind: "path" }) => ValScopeFn;
let _compilePath: (node: ExprNode & { kind: "path" }) => ValScopeFn;

export function setCompilerFns(
  compileNode: typeof _compileNode,
  compilePathWithMissing: typeof _compilePathWithMissing,
  compilePath: typeof _compilePath,
): void {
  _compileNode = compileNode;
  _compilePathWithMissing = compilePathWithMissing;
  _compilePath = compilePath;
}

function compileArgWithMissing(node: ExprNode): ValScopeFn {
  if (node.kind === "path") return _compilePathWithMissing(node);
  return _compileNode(node);
}

export function compileComparison(op: string, args: readonly ExprNode[]): BoolScopeFn {
  const resolveA = compileArgWithMissing(args[0]!);
  const bNode = args[1]!;
  const isLiteral = bNode.kind === "literal";

  if (op === "$eq") {
    if (isLiteral) {
      const bVal = bNode.value;
      return (scope) => {
        const a = resolveA(scope);
        if (a === PATH_MISSING) return bVal === undefined;
        if (Array.isArray(a)) return a.some((v) => normalizeComparable(v) === bVal);
        return normalizeComparable(a) === bVal;
      };
    }
    const resolveB = compileArgWithMissing(bNode);
    return (scope) => {
      const a = resolveA(scope);
      const b = resolveB(scope);
      if (a === PATH_MISSING && b === PATH_MISSING) return true;
      if (a === PATH_MISSING) return b === undefined;
      if (b === PATH_MISSING) return a === undefined;
      if (Array.isArray(a)) return a.some((v) => normalizeComparable(v) === normalizeComparable(b));
      return normalizeComparable(a) === normalizeComparable(b);
    };
  }

  if (op === "$ne") {
    if (isLiteral) {
      const bVal = bNode.value;
      return (scope) => {
        const a = resolveA(scope);
        if (a === PATH_MISSING) return bVal !== undefined;
        if (Array.isArray(a)) return !a.some((v) => normalizeComparable(v) === bVal);
        return normalizeComparable(a) !== bVal;
      };
    }
    const resolveB = compileArgWithMissing(bNode);
    return (scope) => {
      const a = resolveA(scope);
      const b = resolveB(scope);
      if (a === PATH_MISSING && b === PATH_MISSING) return false;
      if (a === PATH_MISSING) return b !== undefined;
      if (b === PATH_MISSING) return a !== undefined;
      if (Array.isArray(a)) return !a.some((v) => normalizeComparable(v) === normalizeComparable(b));
      return normalizeComparable(a) !== normalizeComparable(b);
    };
  }

  // $gt, $gte, $lt, $lte
  const cmpFn = buildCmpFn(op);
  if (isLiteral) {
    const bVal = bNode.value as number | string;
    return (scope) => {
      const a = resolveA(scope);
      if (a === PATH_MISSING) return false;
      if (Array.isArray(a)) {
        return a.some((v) => {
          const nv = normalizeComparable(v);
          return typeof nv === typeof bVal && cmpFn(nv, bVal);
        });
      }
      const na = normalizeComparable(a);
      if (typeof na !== typeof bVal || (typeof na !== "number" && typeof na !== "string")) {
        throw new PredicateError(
          "FORMBAR_EXPR_TYPE_MISMATCH",
          `${op} requires operands of the same type (number or string), got ${typeof na} and ${typeof bVal}`,
        );
      }
      return cmpFn(na, bVal);
    };
  }
  const resolveB = compileArgWithMissing(bNode);
  return (scope) => {
    const a = resolveA(scope);
    const b = resolveB(scope);
    if (a === PATH_MISSING || b === PATH_MISSING) return false;
    if (Array.isArray(a)) {
      const nb = normalizeComparable(b);
      return a.some((v) => {
        const nv = normalizeComparable(v);
        return typeof nv === typeof nb && cmpFn(nv, nb);
      });
    }
    assertComparableTypes(a, b, op);
    return cmpFn(normalizeComparable(a), normalizeComparable(b));
  };
}

export function buildCmpFn(op: string): (a: unknown, b: unknown) => boolean {
  switch (op) {
    case "$gt":
      return (a, b) => (a as number | string) > (b as number | string);
    case "$gte":
      return (a, b) => (a as number | string) >= (b as number | string);
    case "$lt":
      return (a, b) => (a as number | string) < (b as number | string);
    case "$lte":
      return (a, b) => (a as number | string) <= (b as number | string);
    default:
      throw new PredicateError("PREDICATE_UNKNOWN_OPERATOR", `Unknown comparison: ${op}`);
  }
}

export function compileInclusion(args: readonly ExprNode[], negate: boolean): BoolScopeFn {
  const resolveValue = _compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === "literal" && Array.isArray(listNode.value)) {
    const set = new Set(listNode.value as unknown[]);
    return (scope) => {
      const v = resolveValue(scope);
      const found = Array.isArray(v) ? v.some((el) => set.has(el)) : set.has(v);
      return negate ? !found : found;
    };
  }
  const resolveList = _compileNode(listNode);
  const opName = negate ? "$nin" : "$in";
  return (scope) => {
    const arr = resolveList(scope);
    if (!Array.isArray(arr)) {
      throw new PredicateError("FORMBAR_EXPR_TYPE_MISMATCH", `${opName} requires second argument to be an array`);
    }
    const v = resolveValue(scope);
    const found = Array.isArray(v) ? v.some((el) => arr.includes(el)) : arr.includes(v);
    return negate ? !found : found;
  };
}

export function compileRegex(args: readonly ExprNode[]): BoolScopeFn {
  const resolveTarget = _compileNode(args[0]!);
  const patternNode = args[1]!;
  const flagsNode = args.length > 2 ? args[2] : undefined;
  const pattern = patternNode.kind === "literal" ? String(patternNode.value) : null;
  const flags = flagsNode?.kind === "literal" ? String(flagsNode.value) : undefined;

  if (pattern !== null) {
    const re = getCachedRegex(pattern, flags);
    const needsReset = re.global || re.sticky;
    return (scope) => {
      const target = resolveTarget(scope);
      if (needsReset) re.lastIndex = 0;
      if (Array.isArray(target))
        return target.some((v) => {
          if (typeof v !== "string") return false;
          if (needsReset) re.lastIndex = 0;
          return re.test(v);
        });
      if (typeof target !== "string") return false;
      return re.test(target);
    };
  }
  const resolvePattern = _compileNode(patternNode);
  return (scope) => {
    const target = resolveTarget(scope);
    const pat = resolvePattern(scope);
    if (typeof pat !== "string") {
      throw new PredicateError("FORMBAR_EXPR_TYPE_MISMATCH", "$regex requires string operands");
    }
    const re = getCachedRegex(pat, flags);
    const needsReset = re.global || re.sticky;
    if (needsReset) re.lastIndex = 0;
    if (Array.isArray(target))
      return target.some((v) => {
        if (typeof v !== "string") return false;
        if (needsReset) re.lastIndex = 0;
        return re.test(v);
      });
    if (typeof target !== "string") return false;
    return re.test(target);
  };
}

export function compileExists(args: readonly ExprNode[]): BoolScopeFn {
  const resolvePath =
    args[0]?.kind === "path" ? _compilePathWithMissing(args[0] as ExprNode & { kind: "path" }) : _compileNode(args[0]!);
  const expectedNode = args[1]!;
  const expected = expectedNode.kind === "literal" ? Boolean(expectedNode.value) : true;

  return (scope) => {
    const resolved = resolvePath(scope);
    const exists = resolved !== PATH_MISSING;
    return expected ? exists : !exists;
  };
}

export function compileElemMatch(args: readonly ExprNode[], registry?: OperatorRegistry): BoolScopeFn {
  const pathNode = args[0]!;
  const subFilter = _compileNode(args[1]!, registry);

  // For dotted paths, use collectArrayLeaves to mirror kuery's lastPathMustBeArray behavior
  if (pathNode.kind === "path" && pathNode.path.includes(".")) {
    const segments = validateAndSplitPath(pathNode.path);
    return (scope) => {
      const arrays = collectArrayLeaves(scope, segments);
      return arrays.some((arr) => arr.some((el) => Boolean(subFilter(el as Record<string, unknown>))));
    };
  }

  // Simple (non-dotted) path: resolve directly and check if it's an array
  const resolvePath =
    pathNode.kind === "path" ? _compilePath(pathNode as ExprNode & { kind: "path" }) : _compileNode(pathNode);
  return (scope) => {
    const arr = resolvePath(scope);
    if (!Array.isArray(arr)) return false;
    return arr.some((el) => Boolean(subFilter(el as Record<string, unknown>)));
  };
}

export function compileAll(args: readonly ExprNode[]): BoolScopeFn {
  const resolveValue = _compileNode(args[0]!);
  const listNode = args[1]!;
  if (listNode.kind === "literal" && Array.isArray(listNode.value)) {
    const required = listNode.value as readonly unknown[];
    return (scope) => {
      const v = resolveValue(scope);
      if (!Array.isArray(v)) return false;
      return required.every((item) => v.includes(item));
    };
  }
  const resolveList = _compileNode(listNode);
  return (scope) => {
    const v = resolveValue(scope);
    if (!Array.isArray(v)) return false;
    const required = resolveList(scope);
    if (!Array.isArray(required)) {
      throw new PredicateError("FORMBAR_EXPR_TYPE_MISMATCH", "$all requires an array argument");
    }
    return required.every((item) => v.includes(item));
  };
}

export function compileSize(args: readonly ExprNode[]): BoolScopeFn {
  const resolveValue = _compileNode(args[0]!);
  const sizeNode = args[1]!;
  if (sizeNode.kind === "literal" && typeof sizeNode.value === "number") {
    const expected = sizeNode.value;
    return (scope) => {
      const v = resolveValue(scope);
      if (!Array.isArray(v)) return false;
      return v.length === expected;
    };
  }
  const resolveSize = _compileNode(sizeNode);
  return (scope) => {
    const v = resolveValue(scope);
    if (!Array.isArray(v)) return false;
    return v.length === resolveSize(scope);
  };
}
