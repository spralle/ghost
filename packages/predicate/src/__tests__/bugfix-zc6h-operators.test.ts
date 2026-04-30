import { describe, expect, test } from "vitest";
import type { ExprNode } from "../ast.js";
import { evaluate, OperatorRegistry } from "../index.js";

describe("zc6h: custom operator registry wiring", () => {
  test("evaluate uses custom operator from registry", () => {
    const registry = new OperatorRegistry();
    registry.register({ name: "$double", arity: 1 }, (args) => (args[0] as number) * 2);

    const node: ExprNode = { kind: "op", op: "$double", args: [{ kind: "literal", value: 5 }] };
    const result = evaluate(node, {}, { operators: registry });
    expect(result).toBe(10);
  });

  test("custom operator takes precedence over unknown operator error", () => {
    const registry = new OperatorRegistry();
    registry.register({ name: "$custom", arity: 1 }, (args) => `custom:${args[0]}`);

    const node: ExprNode = { kind: "op", op: "$custom", args: [{ kind: "literal", value: "hello" }] };
    const result = evaluate(node, {}, { operators: registry });
    expect(result).toBe("custom:hello");
  });

  test("built-in operators still work with registry", () => {
    const node: ExprNode = {
      kind: "op",
      op: "$eq",
      args: [
        { kind: "literal", value: 1 },
        { kind: "literal", value: 1 },
      ],
    };
    const result = evaluate(node, {}, { operators: new OperatorRegistry() });
    expect(result).toBe(true);
  });

  test("evaluate works without registry (backward compat)", () => {
    const node: ExprNode = {
      kind: "op",
      op: "$eq",
      args: [
        { kind: "literal", value: 1 },
        { kind: "literal", value: 1 },
      ],
    };
    const result = evaluate(node, {});
    expect(result).toBe(true);
  });
});
