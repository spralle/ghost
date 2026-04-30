import { describe, expect, test } from "vitest";
import { compile } from "../compile.js";
import { clearRegexCache, getRegexCacheSize } from "../evaluator.js";
import { compileFilter, compileFilterFromAst } from "../filter-compiler.js";

// ---------------------------------------------------------------------------
// Basic operators
// ---------------------------------------------------------------------------

describe("compileFilter", () => {
  test("empty query matches all docs", () => {
    const filter = compileFilter({});
    expect(filter({ a: 1 })).toBe(true);
    expect(filter({})).toBe(true);
  });

  test("$eq implicit", () => {
    const filter = compileFilter({ status: "active" });
    expect(filter({ status: "active" })).toBe(true);
    expect(filter({ status: "inactive" })).toBe(false);
  });

  test("$eq explicit", () => {
    const filter = compileFilter({ score: { $eq: 42 } });
    expect(filter({ score: 42 })).toBe(true);
    expect(filter({ score: 43 })).toBe(false);
  });

  test("$ne", () => {
    const filter = compileFilter({ status: { $ne: "active" } });
    expect(filter({ status: "inactive" })).toBe(true);
    expect(filter({ status: "active" })).toBe(false);
  });

  test("$gt", () => {
    const filter = compileFilter({ score: { $gt: 50 } });
    expect(filter({ score: 51 })).toBe(true);
    expect(filter({ score: 50 })).toBe(false);
  });

  test("$gte", () => {
    const filter = compileFilter({ score: { $gte: 50 } });
    expect(filter({ score: 50 })).toBe(true);
    expect(filter({ score: 49 })).toBe(false);
  });

  test("$lt", () => {
    const filter = compileFilter({ score: { $lt: 50 } });
    expect(filter({ score: 49 })).toBe(true);
    expect(filter({ score: 50 })).toBe(false);
  });

  test("$lte", () => {
    const filter = compileFilter({ score: { $lte: 50 } });
    expect(filter({ score: 50 })).toBe(true);
    expect(filter({ score: 51 })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Logical operators
  // ---------------------------------------------------------------------------

  test("$and", () => {
    const filter = compileFilter({ $and: [{ status: "active" }, { score: { $gt: 50 } }] });
    expect(filter({ status: "active", score: 60 })).toBe(true);
    expect(filter({ status: "active", score: 40 })).toBe(false);
    expect(filter({ status: "inactive", score: 60 })).toBe(false);
  });

  test("$or", () => {
    const filter = compileFilter({ $or: [{ status: "active" }, { score: { $gt: 90 } }] });
    expect(filter({ status: "active", score: 10 })).toBe(true);
    expect(filter({ status: "inactive", score: 95 })).toBe(true);
    expect(filter({ status: "inactive", score: 10 })).toBe(false);
  });

  test("$not", () => {
    const filter = compileFilter({ $not: { status: "active" } });
    expect(filter({ status: "inactive" })).toBe(true);
    expect(filter({ status: "active" })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Collection operators
  // ---------------------------------------------------------------------------

  test("$in", () => {
    const filter = compileFilter({ role: { $in: ["admin", "moderator"] } });
    expect(filter({ role: "admin" })).toBe(true);
    expect(filter({ role: "moderator" })).toBe(true);
    expect(filter({ role: "user" })).toBe(false);
  });

  test("$nin", () => {
    const filter = compileFilter({ role: { $nin: ["admin", "moderator"] } });
    expect(filter({ role: "user" })).toBe(true);
    expect(filter({ role: "admin" })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // $regex
  // ---------------------------------------------------------------------------

  test("$regex basic", () => {
    const filter = compileFilter({ name: { $regex: "^User" } });
    expect(filter({ name: "User_1" })).toBe(true);
    expect(filter({ name: "Admin_1" })).toBe(false);
  });

  test("$regex with flags", () => {
    const filter = compileFilter({ name: { $regex: "^user", $options: "i" } });
    expect(filter({ name: "User_1" })).toBe(true);
    expect(filter({ name: "user_1" })).toBe(true);
  });

  test("$regex with g flag does not cause stateful lastIndex issues", () => {
    const filter = compileFilter({ name: { $regex: "foo", $options: "g" } });
    expect(filter({ name: "foo bar" })).toBe(true);
    expect(filter({ name: "foo baz" })).toBe(true);
    expect(filter({ name: "foo qux" })).toBe(true);
    expect(filter({ name: "no match" })).toBe(false);
    expect(filter({ name: "foo again" })).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // $exists
  // ---------------------------------------------------------------------------

  test("$exists true — field present", () => {
    const filter = compileFilter({ email: { $exists: true } });
    expect(filter({ email: "a@b.com" })).toBe(true);
    expect(filter({ name: "test" })).toBe(false);
  });

  test("$exists false — field missing", () => {
    const filter = compileFilter({ email: { $exists: false } });
    expect(filter({ name: "test" })).toBe(true);
    expect(filter({ email: "a@b.com" })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // $elemMatch
  // ---------------------------------------------------------------------------

  test("$elemMatch", () => {
    const filter = compileFilter({ orders: { $elemMatch: { amount: { $gte: 100 } } } });
    expect(filter({ orders: [{ amount: 50 }, { amount: 150 }] })).toBe(true);
    expect(filter({ orders: [{ amount: 50 }, { amount: 60 }] })).toBe(false);
    expect(filter({ orders: "not-array" })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Dot-path resolution
  // ---------------------------------------------------------------------------

  test("dot-path", () => {
    const filter = compileFilter({ "address.city": "NYC" });
    expect(filter({ address: { city: "NYC" } })).toBe(true);
    expect(filter({ address: { city: "LA" } })).toBe(false);
  });

  test("deep dot-path", () => {
    const filter = compileFilter({ "a.b.c": 42 });
    expect(filter({ a: { b: { c: 42 } } })).toBe(true);
    expect(filter({ a: { b: { c: 0 } } })).toBe(false);
    expect(filter({ a: null })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Reusability
  // ---------------------------------------------------------------------------

  test("compiled filter is reusable across documents", () => {
    const filter = compileFilter({ status: "active", score: { $gt: 50 } });
    const docs = [
      { status: "active", score: 60 },
      { status: "inactive", score: 70 },
      { status: "active", score: 40 },
      { status: "active", score: 80 },
    ];
    const results = docs.filter(filter);
    expect(results).toEqual([
      { status: "active", score: 60 },
      { status: "active", score: 80 },
    ]);
  });

  // ---------------------------------------------------------------------------
  // Security: prototype pollution
  // ---------------------------------------------------------------------------

  test("rejects __proto__ path at compile time", () => {
    expect(() => compileFilter({ "__proto__.polluted": true })).toThrow("prototype pollution");
  });

  test("rejects constructor path at compile time", () => {
    expect(() => compileFilter({ "constructor.polluted": true })).toThrow("prototype pollution");
  });

  test("rejects prototype path at compile time", () => {
    expect(() => compileFilter({ "prototype.polluted": true })).toThrow("prototype pollution");
  });

  // ---------------------------------------------------------------------------
  // compileFilterFromAst
  // ---------------------------------------------------------------------------

  test("compileFilterFromAst works with pre-compiled AST", () => {
    const ast = compile({ status: "active" });
    const filter = compileFilterFromAst(ast);
    expect(filter({ status: "active" })).toBe(true);
    expect(filter({ status: "inactive" })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Missing field semantics
  // ---------------------------------------------------------------------------

  test("$eq with missing field — implicit eq on missing returns false", () => {
    const filter = compileFilter({ x: "hello" });
    // Missing field: path resolves to undefined, literal is 'hello' → false
    expect(filter({})).toBe(false);
  });

  test("$ne with missing field and non-undefined value", () => {
    const filter = compileFilter({ x: { $ne: "hello" } });
    expect(filter({})).toBe(true);
  });

  test("$gt with missing field returns false", () => {
    const filter = compileFilter({ x: { $gt: 5 } });
    expect(filter({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regex cache LRU
// ---------------------------------------------------------------------------

describe("regex cache LRU", () => {
  test("cache stays bounded at 256 entries", () => {
    clearRegexCache();
    // Use the evaluator's regex path indirectly via evaluate
    // Instead, directly test the cache via compileFilter with $regex
    // The filter compiler creates its own RegExp, not using the evaluator cache.
    // The evaluator cache is tested separately.
    // Here we test the evaluator cache size via getRegexCacheSize.
    const { evaluate } = require("../evaluator.js");
    const { compile: compileQuery } = require("../compile.js");

    for (let i = 0; i < 300; i++) {
      const ast = compileQuery({ name: { $regex: `^pattern_${i}` } });
      evaluate(ast, { name: `pattern_${i}_test` });
    }

    expect(getRegexCacheSize()).toBe(256);
    clearRegexCache();
    expect(getRegexCacheSize()).toBe(0);
  });
});
