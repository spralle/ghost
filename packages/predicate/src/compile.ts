import type { ExprNode } from "./ast.js";
import { PredicateError } from "./errors.js";
import type { TypedQuery } from "./typed-query.js";

/** MongoDB-style query object mapping field names and operators to match values. */
export type Query = Record<string, unknown>;

const LOGICAL_OPS = new Set(["$and", "$or", "$not", "$nor"]);
/** Set of supported comparison operators in query expressions. */
export const COMPARISON_OPS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$exists",
  "$regex",
  "$all",
  "$size",
]);

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 && keys.every((k) => k.startsWith("$"));
}

function makePath(field: string): ExprNode {
  return { kind: "path", path: field };
}

function makeLiteral(value: unknown): ExprNode {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { kind: "literal", value };
  }
  if (value instanceof Date) {
    return { kind: "literal", value: value.getTime() };
  }
  if (Array.isArray(value)) {
    return { kind: "literal", value };
  }
  throw new PredicateError("FORMBAR_EXPR_COMPILE_UNSUPPORTED_LITERAL", `Unsupported literal value: ${String(value)}`);
}

function compileFieldOperators(field: string, operators: Record<string, unknown>): ExprNode {
  const entries = Object.entries(operators);
  const hasOptions = "$options" in operators;
  const nodes: ExprNode[] = [];

  for (const [op, value] of entries) {
    if (op === "$options") continue;

    if (op === "$not") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", "$not requires an object value");
      }
      const inner = compileFieldOperators(field, value as Record<string, unknown>);
      nodes.push({ kind: "op", op: "$not", args: [inner] });
      continue;
    }

    if (op === "$elemMatch") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", "$elemMatch requires an object sub-query");
      }
      nodes.push({ kind: "op", op: "$elemMatch", args: [makePath(field), compile(value as Query)] });
      continue;
    }

    if (op === "$regex") {
      let pattern: string;
      let flags: string | undefined;
      if (value instanceof RegExp) {
        pattern = value.source;
        flags = value.flags || undefined;
      } else {
        pattern = String(value);
      }
      const regexArgs: ExprNode[] = [makePath(field), makeLiteral(pattern)];
      if (hasOptions) {
        regexArgs.push(makeLiteral(String(operators["$options"])));
      } else if (flags) {
        regexArgs.push(makeLiteral(flags));
      }
      nodes.push({ kind: "op", op: "$regex", args: regexArgs });
      continue;
    }

    if (!COMPARISON_OPS.has(op)) {
      throw new PredicateError("PREDICATE_UNKNOWN_OPERATOR", `Unknown operator: ${op}`);
    }
    if (op === "$in" || op === "$nin") {
      if (!Array.isArray(value)) {
        throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", `${op} requires an array value`);
      }
      nodes.push({ kind: "op", op, args: [makePath(field), makeLiteral(value)] });
      continue;
    }
    if (op === "$all") {
      if (!Array.isArray(value)) {
        throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", "$all requires an array value");
      }
      nodes.push({ kind: "op", op: "$all", args: [makePath(field), makeLiteral(value)] });
      continue;
    }
    if (op === "$size") {
      nodes.push({ kind: "op", op: "$size", args: [makePath(field), makeLiteral(value)] });
      continue;
    }
    if (op === "$exists") {
      nodes.push({ kind: "op", op: "$exists", args: [makePath(field), makeLiteral(Boolean(value))] });
      continue;
    }
    nodes.push({ kind: "op", op, args: [makePath(field), makeLiteral(value)] });
  }

  if (nodes.length === 1) return nodes[0];
  return { kind: "op", op: "$and", args: nodes };
}

function compileFieldEntry(field: string, value: unknown): ExprNode {
  if (value instanceof RegExp) {
    const args: ExprNode[] = [makePath(field), makeLiteral(value.source)];
    if (value.flags) {
      args.push(makeLiteral(value.flags));
    }
    return { kind: "op", op: "$regex", args };
  }
  if (isOperatorObject(value)) {
    return compileFieldOperators(field, value as Record<string, unknown>);
  }
  return { kind: "op", op: "$eq", args: [makePath(field), makeLiteral(value)] };
}

function compileLogicalOp(op: string, value: unknown): ExprNode {
  if (op === "$not") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", "$not requires an object value");
    }
    return { kind: "op", op: "$not", args: [compile(value as Query)] };
  }
  if (!Array.isArray(value)) {
    throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", `${op} requires an array of conditions`);
  }
  const args = (value as unknown[]).map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new PredicateError("FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS", `${op} array items must be objects`);
    }
    return compile(item as Query);
  });
  if (op === "$nor") {
    return { kind: "op", op: "$not", args: [{ kind: "op", op: "$or", args }] };
  }
  return { kind: "op", op, args };
}

/**
 * Compiles a MongoDB-style shorthand query into the predicate AST.
 *
 * Supports field-implicit equality, operator objects, logical combinators,
 * and dot-notation paths.
 */
export function compile<T>(query: TypedQuery<T>): ExprNode;
export function compile(query: Query): ExprNode;
export function compile(query: Query): ExprNode {
  const entries = Object.entries(query);

  if (entries.length === 0) {
    return { kind: "literal", value: true };
  }

  const nodes: ExprNode[] = [];

  for (const [key, value] of entries) {
    if (LOGICAL_OPS.has(key)) {
      nodes.push(compileLogicalOp(key, value));
    } else {
      nodes.push(compileFieldEntry(key, value));
    }
  }

  if (nodes.length === 1) return nodes[0];
  return { kind: "op", op: "$and", args: nodes };
}

/** @deprecated Use `compile` instead */
export const compileShorthand = compile;
/** @deprecated Use `Query` instead */
export type ShorthandQuery = Query;
