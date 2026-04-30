import { describe, expect, it } from "vitest";
import type { ExprNode } from "../ast.js";
import { PredicateError } from "../errors.js";
import { evaluate } from "../evaluator.js";

function makeScope(
  data: Record<string, unknown> = {},
  uiState: unknown = {},
  meta: unknown = {},
): Record<string, unknown> {
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

describe("evaluate", () => {
  const scope = makeScope();

  describe("literals", () => {
    it("evaluates number literal", () => {
      expect(evaluate(lit(42), scope)).toBe(42);
    });

    it("evaluates null literal", () => {
      expect(evaluate(lit(null), scope)).toBe(null);
    });

    it("evaluates string literal", () => {
      expect(evaluate(lit("hello"), scope)).toBe("hello");
    });

    it("evaluates boolean literal", () => {
      expect(evaluate(lit(true), scope)).toBe(true);
    });
  });

  describe("path resolution", () => {
    it("resolves data path", () => {
      const s = makeScope({ customer: { email: "a@b.com" } });
      expect(evaluate(path("customer.email"), s)).toBe("a@b.com");
    });

    it("resolves $ui path", () => {
      const s = makeScope({}, { visible: true });
      expect(evaluate(path("$ui.visible"), s)).toBe(true);
    });

    it("returns undefined for missing path without throwing", () => {
      const s = makeScope({});
      expect(evaluate(path("nonexistent.field"), s)).toBeUndefined();
    });

    it("returns undefined for nested missing path", () => {
      const s = makeScope({});
      expect(evaluate(path("a.b.c"), s)).toBeUndefined();
    });
  });

  describe("$eq / $ne", () => {
    it("$eq(42, 42) → true", () => {
      expect(evaluate(op("$eq", lit(42), lit(42)), scope)).toBe(true);
    });

    it('$eq(42, "42") → false (no coercion)', () => {
      expect(evaluate(op("$eq", lit(42), lit("42")), scope)).toBe(false);
    });

    it("$eq(null, null) → true", () => {
      expect(evaluate(op("$eq", lit(null), lit(null)), scope)).toBe(true);
    });

    it("$eq(null, undefined) → false (ADR 5.4)", () => {
      const s = makeScope({});
      // path to missing field yields undefined, literal null is null
      expect(evaluate(op("$eq", lit(null), path("missing")), s)).toBe(false);
    });

    it("$ne(1, 2) → true", () => {
      expect(evaluate(op("$ne", lit(1), lit(2)), scope)).toBe(true);
    });
  });

  describe("comparison operators", () => {
    it("$gt(10, 5) → true", () => {
      expect(evaluate(op("$gt", lit(10), lit(5)), scope)).toBe(true);
    });

    it('$gt("b", "a") → true', () => {
      expect(evaluate(op("$gt", lit("b"), lit("a")), scope)).toBe(true);
    });

    it('$gt(10, "5") → throws FORMR_EXPR_TYPE_MISMATCH', () => {
      expect(() => evaluate(op("$gt", lit(10), lit("5")), scope)).toThrow(PredicateError);
    });

    it("$lte(5, 5) → true", () => {
      expect(evaluate(op("$lte", lit(5), lit(5)), scope)).toBe(true);
    });

    it("$lt(3, 5) → true", () => {
      expect(evaluate(op("$lt", lit(3), lit(5)), scope)).toBe(true);
    });

    it("$gte(5, 5) → true", () => {
      expect(evaluate(op("$gte", lit(5), lit(5)), scope)).toBe(true);
    });

    it("$gt with missing path returns false (not throw)", () => {
      const s = makeScope({});
      expect(evaluate(op("$gt", path("missing"), lit(5)), s)).toBe(false);
    });

    it("$lt with missing path returns false (not throw)", () => {
      const s = makeScope({});
      expect(evaluate(op("$lt", path("missing"), lit(5)), s)).toBe(false);
    });

    it("$gte with missing path returns false", () => {
      const s = makeScope({});
      expect(evaluate(op("$gte", path("missing"), lit(5)), s)).toBe(false);
    });

    it("$lte with missing path returns false", () => {
      const s = makeScope({});
      expect(evaluate(op("$lte", path("missing"), lit(5)), s)).toBe(false);
    });
  });

  describe("unknown operator", () => {
    it("throws PREDICATE_UNKNOWN_OPERATOR for unknown op", () => {
      try {
        evaluate(op("$bogus", lit(1)), scope);
        expect(true).toBe(false); // should not reach
      } catch (e) {
        expect(e).toBeInstanceOf(PredicateError);
        expect((e as PredicateError).code).toBe("PREDICATE_UNKNOWN_OPERATOR");
      }
    });
  });

  describe("logical operators", () => {
    it("$and(true, true) → true", () => {
      expect(evaluate(op("$and", lit(true), lit(true)), scope)).toBe(true);
    });

    it("$and(true, false) → false", () => {
      expect(evaluate(op("$and", lit(true), lit(false)), scope)).toBe(false);
    });

    it("$or(false, true) → true", () => {
      expect(evaluate(op("$or", lit(false), lit(true)), scope)).toBe(true);
    });

    it("$not(true) → false", () => {
      expect(evaluate(op("$not", lit(true)), scope)).toBe(false);
    });
  });

  describe("collection operators", () => {
    it("$in(1, [1,2,3]) → true", () => {
      // $in needs array as second arg — use a path to scope data containing array
      const s = makeScope({ list: [1, 2, 3] });
      expect(evaluate(op("$in", lit(1), path("list")), s)).toBe(true);
    });

    it("$in(4, [1,2,3]) → false", () => {
      const s = makeScope({ list: [1, 2, 3] });
      expect(evaluate(op("$in", lit(4), path("list")), s)).toBe(false);
    });

    it("$nin(4, [1,2,3]) → true", () => {
      const s = makeScope({ list: [1, 2, 3] });
      expect(evaluate(op("$nin", lit(4), path("list")), s)).toBe(true);
    });
  });

  describe("$exists", () => {
    it("returns true for defined value with expected=true", () => {
      const s = makeScope({ name: "Alice" });
      expect(evaluate(op("$exists", path("name"), lit(true)), s)).toBe(true);
    });

    it("returns false for missing path with expected=true", () => {
      const s = makeScope({});
      expect(evaluate(op("$exists", path("missing"), lit(true)), s)).toBe(false);
    });

    it("null field with $exists → true (null is defined)", () => {
      const s = makeScope({ value: null });
      expect(evaluate(op("$exists", path("value"), lit(true)), s)).toBe(true);
    });

    it("undefined/missing field with $exists → false", () => {
      const s = makeScope({});
      expect(evaluate(op("$exists", path("nope"), lit(true)), s)).toBe(false);
    });
  });
});
