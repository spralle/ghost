import { describe, expect, it } from "vitest";
import type { ExprNode } from "../ast.js";
import { compile } from "../compile.js";
import { PredicateError } from "../errors.js";
import { evaluate } from "../evaluator.js";

/**
 * F3: Expressions/rules conformance fixtures.
 * Verifies: AST execution correct, operator typing enforced,
 * no coercion, compiler correctness.
 */

function scope(data: Record<string, unknown> = {}, uiState: unknown = {}, meta: unknown = {}): Record<string, unknown> {
  return { ...data, $ui: uiState, $meta: meta };
}

function lit(value: string | number | boolean | null): ExprNode {
  return { kind: "literal", value };
}

function path(p: string): ExprNode {
  return { kind: "path", path: p };
}

function op(name: string, ...args: ExprNode[]): ExprNode {
  return { kind: "op", op: name, args };
}

describe("F3: AST execution correctness", () => {
  it("literal evaluation is identity", () => {
    expect(evaluate(lit(42), scope())).toBe(42);
    expect(evaluate(lit("hello"), scope())).toBe("hello");
    expect(evaluate(lit(true), scope())).toBe(true);
    expect(evaluate(lit(null), scope())).toBe(null);
  });

  it("path resolution traverses nested data", () => {
    const s = scope({ a: { b: { c: 99 } } });
    expect(evaluate(path("a.b.c"), s)).toBe(99);
  });

  it("path resolution for $ui namespace", () => {
    const s = scope({}, { visible: true, nested: { x: 1 } });
    expect(evaluate(path("$ui.visible"), s)).toBe(true);
    expect(evaluate(path("$ui.nested.x"), s)).toBe(1);
  });

  it("path resolution for $meta namespace", () => {
    const s = scope({}, {}, { stage: "draft" });
    expect(evaluate(path("$meta.stage"), s)).toBe("draft");
  });

  it("missing path returns undefined without throwing", () => {
    expect(evaluate(path("nonexistent"), scope())).toBeUndefined();
    expect(evaluate(path("a.b.c"), scope())).toBeUndefined();
  });

  it("$eq with same types", () => {
    expect(evaluate(op("$eq", lit(1), lit(1)), scope())).toBe(true);
    expect(evaluate(op("$eq", lit("a"), lit("a")), scope())).toBe(true);
    expect(evaluate(op("$eq", lit(1), lit(2)), scope())).toBe(false);
  });

  it("$and / $or / $not logical operators", () => {
    expect(evaluate(op("$and", lit(true), lit(true)), scope())).toBe(true);
    expect(evaluate(op("$and", lit(true), lit(false)), scope())).toBe(false);
    expect(evaluate(op("$or", lit(false), lit(true)), scope())).toBe(true);
    expect(evaluate(op("$not", lit(false)), scope())).toBe(true);
  });

  it("$in / $nin with array data", () => {
    const s = scope({ list: [1, 2, 3] });
    expect(evaluate(op("$in", lit(2), path("list")), s)).toBe(true);
    expect(evaluate(op("$nin", lit(5), path("list")), s)).toBe(true);
  });

  it("$exists checks path presence", () => {
    const s = scope({ name: "Alice" });
    expect(evaluate(op("$exists", path("name"), lit(true)), s)).toBe(true);
    expect(evaluate(op("$exists", path("missing"), lit(true)), s)).toBe(false);
    expect(evaluate(op("$exists", path("missing"), lit(false)), s)).toBe(true);
  });
});

describe("F3: Operator typing enforced — no coercion", () => {
  it('$eq(42, "42") → false (strict equality, no coercion)', () => {
    expect(evaluate(op("$eq", lit(42), lit("42")), scope())).toBe(false);
  });

  it("$gt with mixed types throws FORMR_EXPR_TYPE_MISMATCH", () => {
    expect(() => evaluate(op("$gt", lit(10), lit("5")), scope())).toThrow(PredicateError);
    try {
      evaluate(op("$gt", lit(10), lit("5")), scope());
    } catch (e) {
      expect((e as PredicateError).code).toBe("FORMR_EXPR_TYPE_MISMATCH");
    }
  });

  it("$lt with mixed types throws FORMR_EXPR_TYPE_MISMATCH", () => {
    expect(() => evaluate(op("$lt", lit("a"), lit(1)), scope())).toThrow(PredicateError);
  });

  it("$gte with mixed types throws FORMR_EXPR_TYPE_MISMATCH", () => {
    expect(() => evaluate(op("$gte", lit(true), lit(1)), scope())).toThrow(PredicateError);
  });

  it("$in with non-array second arg throws FORMR_EXPR_TYPE_MISMATCH", () => {
    expect(() => evaluate(op("$in", lit(1), lit("not-array")), scope())).toThrow(PredicateError);
  });

  it("unknown operator throws", () => {
    expect(() => evaluate(op("$unknown", lit(1)), scope())).toThrow(PredicateError);
  });
});

describe("F3: Compiler correctness", () => {
  it("compiles $eq via shorthand", () => {
    const ast = compile({ x: 42 });
    expect(ast.kind).toBe("op");
    if (ast.kind === "op") {
      expect(ast.op).toBe("$eq");
      expect(ast.args).toHaveLength(2);
    }
  });

  it("compiles $eq with explicit operator", () => {
    const ast = compile({ x: { $eq: 42 } });
    expect(ast.kind).toBe("op");
    if (ast.kind === "op") {
      expect(ast.op).toBe("$eq");
      expect(ast.args).toHaveLength(2);
    }
  });

  it("rejects unknown operators in field expressions", () => {
    expect(() => compile({ x: { $bogus: 1 } })).toThrow("Unknown operator");
  });

  it("empty query compiles to literal true", () => {
    const ast = compile({});
    expect(ast).toEqual(lit(true));
  });
});
