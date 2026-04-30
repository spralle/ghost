import { describe, expect, test } from "vitest";
import { compileFilter } from "../filter-compiler.js";
import { Predicate } from "../predicate.js";

describe("$nor", () => {
  const data = [
    { name: "alice", role: "admin" },
    { name: "bob", role: "user" },
    { name: "charlie", role: "admin" },
    { name: "diana", role: "moderator" },
  ];

  test("excludes documents matching any condition", () => {
    const p = new Predicate({ $nor: [{ role: "admin" }, { role: "moderator" }] });
    const result = p.find(data);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("bob");
  });

  test("returns all when no conditions match", () => {
    const p = new Predicate({ $nor: [{ role: "superadmin" }] });
    expect(p.find(data)).toHaveLength(4);
  });

  test("returns none when all match some condition", () => {
    const p = new Predicate({ $nor: [{ role: "admin" }, { role: "user" }, { role: "moderator" }] });
    expect(p.find(data)).toHaveLength(0);
  });
});

describe("$all", () => {
  const data = [
    { name: "alice", tags: ["js", "ts", "react"] },
    { name: "bob", tags: ["js", "python"] },
    { name: "charlie", tags: ["ts", "react"] },
    { name: "diana", tags: ["js", "ts"] },
  ];

  test("matches documents containing all specified values", () => {
    const filter = compileFilter({ tags: { $all: ["js", "ts"] } });
    const result = data.filter((d) => filter(d as Record<string, unknown>));
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("alice");
    expect(result[1].name).toBe("diana");
  });

  test("single value acts like $in for one element", () => {
    const filter = compileFilter({ tags: { $all: ["python"] } });
    const result = data.filter((d) => filter(d as Record<string, unknown>));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("bob");
  });

  test("returns empty when no document has all values", () => {
    const filter = compileFilter({ tags: { $all: ["js", "rust"] } });
    expect(data.filter((d) => filter(d as Record<string, unknown>))).toHaveLength(0);
  });

  test("returns false for non-array field", () => {
    const filter = compileFilter({ name: { $all: ["alice"] } });
    expect(filter({ name: "alice" })).toBe(false);
  });
});

describe("$size", () => {
  const data = [
    { name: "alice", tags: ["js", "ts", "react"] },
    { name: "bob", tags: ["js"] },
    { name: "charlie", tags: [] },
    { name: "diana", tags: ["js", "ts"] },
  ];

  test("matches arrays of exact length", () => {
    const filter = compileFilter({ tags: { $size: 2 } });
    const result = data.filter((d) => filter(d as Record<string, unknown>));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("diana");
  });

  test("matches empty arrays with size 0", () => {
    const filter = compileFilter({ tags: { $size: 0 } });
    const result = data.filter((d) => filter(d as Record<string, unknown>));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("charlie");
  });

  test("returns false for non-array field", () => {
    const filter = compileFilter({ name: { $size: 5 } });
    expect(filter({ name: "alice" })).toBe(false);
  });

  test("no match when size differs", () => {
    const filter = compileFilter({ tags: { $size: 99 } });
    expect(data.filter((d) => filter(d as Record<string, unknown>))).toHaveLength(0);
  });
});
