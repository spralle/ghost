import { describe, expect, it } from "vitest";
import { find, findOne } from "../collection/index.js";

interface Item {
  readonly name: string;
  readonly age: number;
  readonly role?: string;
}

const DATA: readonly Item[] = [
  { name: "alice", age: 30, role: "admin" },
  { name: "bob", age: 25, role: "user" },
  { name: "charlie", age: 35, role: "admin" },
  { name: "diana", age: 28, role: "user" },
  { name: "eve", age: 30, role: "moderator" },
];

describe("find", () => {
  it("filters by equality", () => {
    const result = find(DATA, { role: "admin" });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("alice");
    expect(result[1].name).toBe("charlie");
  });

  it("filters by operator", () => {
    const result = find(DATA, { age: { $gt: 28 } });
    expect(result).toHaveLength(3);
  });

  it("applies sort ascending", () => {
    const result = find(DATA, { role: "admin" }, { sort: { age: 1 } });
    expect(result[0].name).toBe("alice");
    expect(result[1].name).toBe("charlie");
  });

  it("applies sort descending", () => {
    const result = find(DATA, { role: "admin" }, { sort: { age: -1 } });
    expect(result[0].name).toBe("charlie");
    expect(result[1].name).toBe("alice");
  });

  it("applies skip", () => {
    const result = find(DATA, { age: { $gte: 25 } }, { skip: 2 });
    expect(result).toHaveLength(3);
  });

  it("applies limit", () => {
    const result = find(DATA, { age: { $gte: 25 } }, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("applies skip and limit together", () => {
    const result = find(DATA, { age: { $gte: 25 } }, { skip: 1, limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("bob");
  });

  it("handles complex query with $and", () => {
    const result = find(DATA, { $and: [{ role: "admin" }, { age: { $gte: 35 } }] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("charlie");
  });

  it("returns empty for no matches", () => {
    const result = find(DATA, { name: "nobody" });
    expect(result).toHaveLength(0);
  });

  it("returns all for empty query", () => {
    const result = find(DATA, {});
    expect(result).toHaveLength(5);
  });

  it("multi-field sort", () => {
    const result = find(DATA, { age: { $gte: 25 } }, { sort: { age: 1, name: -1 } });
    expect(result[0].name).toBe("bob");
    expect(result[1].name).toBe("diana");
  });
});

describe("findOne", () => {
  it("returns first match", () => {
    const result = findOne(DATA, { role: "user" });
    expect(result).toBeDefined();
    expect(result?.name).toBe("bob");
  });

  it("returns undefined for no match", () => {
    const result = findOne(DATA, { name: "nobody" });
    expect(result).toBeUndefined();
  });
});
