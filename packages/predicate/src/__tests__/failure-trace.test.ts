import { describe, expect, it } from "vitest";
import { compile } from "../compile.js";
import { evaluateWithTrace } from "../failure-trace.js";

describe("evaluateWithTrace", () => {
  it("returns empty traces when all conditions pass", () => {
    const ast = compile({ name: "alice", age: 30 });
    const { result, traces } = evaluateWithTrace(ast, { name: "alice", age: 30 });
    expect(result).toBe(true);
    expect(traces).toHaveLength(0);
  });

  it("collects trace for failing $eq", () => {
    const ast = compile({ name: "alice" });
    const { result, traces } = evaluateWithTrace(ast, { name: "bob" });
    expect(result).toBe(false);
    expect(traces).toHaveLength(1);
    expect(traces[0].path).toBe("name");
    expect(traces[0].operator).toBe("$eq");
    expect(traces[0].expected).toBe("alice");
    expect(traces[0].actual).toBe("bob");
  });

  it("collects traces for multiple failing conditions", () => {
    const ast = compile({ name: "alice", age: 30 });
    const { result, traces } = evaluateWithTrace(ast, { name: "bob", age: 25 });
    expect(result).toBe(false);
    expect(traces).toHaveLength(2);
  });

  it("collects trace for failing $gt", () => {
    const ast = compile({ age: { $gt: 30 } });
    const { result, traces } = evaluateWithTrace(ast, { age: 25 });
    expect(result).toBe(false);
    expect(traces).toHaveLength(1);
    expect(traces[0].operator).toBe("$gt");
    expect(traces[0].expected).toBe(30);
    expect(traces[0].actual).toBe(25);
  });

  it("collects trace for failing $in", () => {
    const ast = compile({ role: { $in: ["admin", "moderator"] } });
    const { result, traces } = evaluateWithTrace(ast, { role: "user" });
    expect(result).toBe(false);
    expect(traces).toHaveLength(1);
    expect(traces[0].operator).toBe("$in");
  });

  it("handles nested $and with partial failures", () => {
    const ast = compile({
      $and: [{ name: "alice" }, { age: { $gte: 40 } }],
    });
    const { result, traces } = evaluateWithTrace(ast, { name: "alice", age: 30 });
    expect(result).toBe(false);
    expect(traces).toHaveLength(1);
    expect(traces[0].operator).toBe("$gte");
  });

  it("handles dot-path fields", () => {
    const ast = compile({ "user.name": "alice" });
    const { result, traces } = evaluateWithTrace(ast, { user: { name: "bob" } });
    expect(result).toBe(false);
    expect(traces[0].path).toBe("user.name");
    expect(traces[0].actual).toBe("bob");
  });
});
