import { describe, expect, test } from "vitest";
import type { EvaluationScope } from "../ast.js";
import { find } from "../collection/find.js";
import { compile } from "../compile.js";
import { evaluate } from "../evaluator.js";

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe("benchmark: evaluate()", () => {
  const ast = compile({ status: "active" });
  const scope: EvaluationScope = { status: "active", count: 42 };

  test("1000 simple evaluations < 100ms", () => {
    const ms = time(() => {
      for (let i = 0; i < 1000; i++) {
        evaluate(ast, scope);
      }
    });
    expect(ms).toBeLessThan(100);
  });

  test("1000 nested evaluations < 200ms", () => {
    const nested = compile({
      status: "active",
      count: { $gt: 0 },
      $or: [{ role: "admin" }, { count: { $gte: 10 } }],
    });
    const s: EvaluationScope = { status: "active", count: 42, role: "user" };
    const ms = time(() => {
      for (let i = 0; i < 1000; i++) {
        evaluate(nested, s);
      }
    });
    expect(ms).toBeLessThan(200);
  });
});

describe("benchmark: compile()", () => {
  test("1000 compilations < 200ms", () => {
    const input = { a: 1, b: { $gt: 2 } };
    const ms = time(() => {
      for (let i = 0; i < 1000; i++) {
        compile(input);
      }
    });
    expect(ms).toBeLessThan(200);
  });
});

describe("benchmark: find()", () => {
  function makeCollection(size: number): readonly Record<string, unknown>[] {
    return Array.from({ length: size }, (_, i) => ({
      id: i,
      status: i % 3 === 0 ? "active" : "inactive",
      score: i * 10,
      name: `item-${String(i)}`,
    }));
  }

  test("find over 100 items < 50ms", () => {
    const items = makeCollection(100);
    const ms = time(() => {
      find(items, { status: "active" });
    });
    expect(ms).toBeLessThan(50);
  });

  test("find over 1000 items < 100ms", () => {
    const items = makeCollection(1000);
    const ms = time(() => {
      find(items, { status: "active", score: { $gt: 500 } });
    });
    expect(ms).toBeLessThan(100);
  });

  test("find over 10000 items < 500ms", () => {
    const items = makeCollection(10000);
    const ms = time(() => {
      find(items, { status: "active" });
    });
    expect(ms).toBeLessThan(500);
  });

  test("find with sort over 1000 items < 200ms", () => {
    const items = makeCollection(1000);
    const ms = time(() => {
      find(items, { status: "active" }, { sort: { score: -1 }, limit: 10 });
    });
    expect(ms).toBeLessThan(200);
  });
});
