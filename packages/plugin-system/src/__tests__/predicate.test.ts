import { describe, expect, it } from "vitest";
import type { PredicateEvaluationResult } from "../predicate.js";
import { createDefaultContributionPredicateMatcher, evaluateContributionPredicate } from "../predicate.js";

function evalPredicate(predicate: Record<string, unknown>, facts: Record<string, unknown>): PredicateEvaluationResult {
  const matcher = createDefaultContributionPredicateMatcher();
  return matcher.evaluate(predicate, facts);
}

describe("predicate", () => {
  describe("basic equality", () => {
    it("matches direct string equality", () => {
      const result = evalPredicate({ key: "value" }, { key: "value" });
      expect(result.matched).toBe(true);
      expect(result.failedPredicates).toHaveLength(0);
    });

    it("fails on string mismatch", () => {
      const result = evalPredicate({ key: "value" }, { key: "other" });
      expect(result.matched).toBe(false);
      expect(result.failedPredicates).toHaveLength(1);
      expect(result.failedPredicates[0].path).toBe("key");
    });

    it("matches numeric equality", () => {
      expect(evalPredicate({ x: 42 }, { x: 42 }).matched).toBe(true);
    });

    it("matches boolean equality", () => {
      expect(evalPredicate({ flag: true }, { flag: true }).matched).toBe(true);
    });

    it("matches null equality", () => {
      expect(evalPredicate({ key: null }, { key: null }).matched).toBe(true);
    });
  });

  describe("deep equality", () => {
    it("matches arrays deeply", () => {
      expect(evalPredicate({ arr: [1, 2, 3] }, { arr: [1, 2, 3] }).matched).toBe(true);
    });

    it("fails on array length mismatch", () => {
      expect(evalPredicate({ arr: [1, 2] }, { arr: [1, 2, 3] }).matched).toBe(false);
    });

    it("matches objects deeply", () => {
      expect(evalPredicate({ obj: { a: 1, b: 2 } }, { obj: { a: 1, b: 2 } }).matched).toBe(true);
    });

    it("fails on object key mismatch", () => {
      expect(evalPredicate({ obj: { a: 1 } }, { obj: { a: 1, b: 2 } }).matched).toBe(false);
    });
  });

  describe("nested path resolution", () => {
    it("resolves dot-separated paths", () => {
      const result = evalPredicate({ "a.b.c": "deep" }, { a: { b: { c: "deep" } } });
      expect(result.matched).toBe(true);
    });

    it("returns undefined for missing nested paths", () => {
      const result = evalPredicate({ "a.b.c": "deep" }, { a: { b: {} } });
      expect(result.matched).toBe(false);
      expect(result.failedPredicates[0].actual).toBeUndefined();
    });

    it("returns undefined for non-object intermediate", () => {
      const result = evalPredicate({ "a.b.c": "deep" }, { a: { b: 42 } });
      expect(result.matched).toBe(false);
    });
  });

  describe("$eq operator", () => {
    it("matches with $eq", () => {
      expect(evalPredicate({ key: { $eq: "value" } }, { key: "value" }).matched).toBe(true);
    });

    it("deep-equals with $eq on objects", () => {
      expect(evalPredicate({ key: { $eq: { a: 1 } } }, { key: { a: 1 } }).matched).toBe(true);
    });
  });

  describe("$ne operator", () => {
    it("matches when not equal", () => {
      expect(evalPredicate({ key: { $ne: "other" } }, { key: "value" }).matched).toBe(true);
    });

    it("fails when equal", () => {
      expect(evalPredicate({ key: { $ne: "value" } }, { key: "value" }).matched).toBe(false);
    });
  });

  describe("$exists operator", () => {
    it("matches when key exists and $exists is true", () => {
      expect(evalPredicate({ key: { $exists: true } }, { key: "anything" }).matched).toBe(true);
    });

    it("fails when key missing and $exists is true", () => {
      expect(evalPredicate({ key: { $exists: true } }, {}).matched).toBe(false);
    });

    it("matches when key missing and $exists is false", () => {
      expect(evalPredicate({ key: { $exists: false } }, {}).matched).toBe(true);
    });

    it("fails when key exists and $exists is false", () => {
      expect(evalPredicate({ key: { $exists: false } }, { key: "val" }).matched).toBe(false);
    });
  });

  describe("$in operator", () => {
    it("matches when value is in array", () => {
      expect(evalPredicate({ key: { $in: ["a", "b", "c"] } }, { key: "b" }).matched).toBe(true);
    });

    it("fails when value is not in array", () => {
      expect(evalPredicate({ key: { $in: ["a", "b"] } }, { key: "c" }).matched).toBe(false);
    });

    it("uses deep equality for $in", () => {
      expect(evalPredicate({ key: { $in: [{ a: 1 }, { b: 2 }] } }, { key: { a: 1 } }).matched).toBe(true);
    });
  });

  describe("$nin operator", () => {
    it("matches when value is not in array", () => {
      expect(evalPredicate({ key: { $nin: ["a", "b"] } }, { key: "c" }).matched).toBe(true);
    });

    it("fails when value is in array", () => {
      expect(evalPredicate({ key: { $nin: ["a", "b"] } }, { key: "a" }).matched).toBe(false);
    });
  });

  describe("$gt/$gte/$lt/$lte operators", () => {
    it("$gt matches when greater", () => {
      expect(evalPredicate({ x: { $gt: 5 } }, { x: 10 }).matched).toBe(true);
    });

    it("$gt fails when equal", () => {
      expect(evalPredicate({ x: { $gt: 5 } }, { x: 5 }).matched).toBe(false);
    });

    it("$gte matches when equal", () => {
      expect(evalPredicate({ x: { $gte: 5 } }, { x: 5 }).matched).toBe(true);
    });

    it("$lt matches when less", () => {
      expect(evalPredicate({ x: { $lt: 10 } }, { x: 5 }).matched).toBe(true);
    });

    it("$lte matches when equal", () => {
      expect(evalPredicate({ x: { $lte: 10 } }, { x: 10 }).matched).toBe(true);
    });

    it("string comparison with $gt", () => {
      expect(evalPredicate({ name: { $gt: "a" } }, { name: "b" }).matched).toBe(true);
    });

    it("mixed-type comparison returns false (backward compat)", () => {
      expect(evalPredicate({ x: { $gt: 5 } }, { x: "string" }).matched).toBe(false);
    });

    it("mixed-type $lt returns false", () => {
      expect(evalPredicate({ x: { $lt: "abc" } }, { x: 42 }).matched).toBe(false);
    });

    it("undefined value with $gt returns false", () => {
      expect(evalPredicate({ x: { $gt: 5 } }, {}).matched).toBe(false);
    });
  });

  describe("unknown operator", () => {
    it("returns false for unknown operators", () => {
      expect(evalPredicate({ key: { $unknown: "val" } }, { key: "val" }).matched).toBe(false);
    });
  });

  describe("evaluateContributionPredicate convenience function", () => {
    it("returns true when predicate is undefined", () => {
      expect(evaluateContributionPredicate(undefined, {})).toBe(true);
    });

    it("returns true when predicate matches", () => {
      expect(evaluateContributionPredicate({ key: "val" }, { key: "val" })).toBe(true);
    });

    it("returns false when predicate does not match", () => {
      expect(evaluateContributionPredicate({ key: "val" }, { key: "other" })).toBe(false);
    });
  });

  describe("failure traces", () => {
    it("includes path, actual, and condition in trace", () => {
      const result = evalPredicate({ x: { $gt: 10 } }, { x: 3 });
      expect(result.matched).toBe(false);
      expect(result.failedPredicates).toHaveLength(1);
      expect(result.failedPredicates[0]).toEqual({
        path: "x",
        actual: 3,
        condition: { $gt: 10 },
      });
    });

    it("reports multiple failures", () => {
      const result = evalPredicate({ a: "x", b: "y" }, { a: "wrong", b: "wrong" });
      expect(result.failedPredicates).toHaveLength(2);
    });
  });

  describe("multiple conditions on same path", () => {
    it("matches when all conditions pass", () => {
      expect(evalPredicate({ x: { $gt: 1, $lt: 10 } }, { x: 5 }).matched).toBe(true);
    });

    it("fails when one condition fails", () => {
      expect(evalPredicate({ x: { $gt: 1, $lt: 10 } }, { x: 15 }).matched).toBe(false);
    });
  });

  describe("prototype pollution guard", () => {
    it("returns undefined for __proto__ path", () => {
      const result = evalPredicate({ __proto__: "value" }, {});
      expect(result.failedPredicates[0]?.actual).toBeUndefined();
    });

    it("returns undefined for constructor path", () => {
      const result = evalPredicate({ constructor: "value" }, {});
      expect(result.failedPredicates[0]?.actual).toBeUndefined();
    });

    it("returns undefined for prototype path", () => {
      const result = evalPredicate({ prototype: "value" }, {});
      expect(result.failedPredicates[0]?.actual).toBeUndefined();
    });

    it("returns undefined for nested __proto__ segment", () => {
      const result = evalPredicate({ "a.__proto__.b": "value" }, { a: { nested: true } });
      expect(result.failedPredicates[0]?.actual).toBeUndefined();
    });

    it("returns undefined for nested constructor segment", () => {
      const result = evalPredicate({ "a.constructor.name": "value" }, { a: {} });
      expect(result.failedPredicates[0]?.actual).toBeUndefined();
    });
  });
});
