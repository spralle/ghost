import { describe, expect, it } from "vitest";
import { assertSerializableArgs, isSerializable } from "../serialization-guard.js";

describe("isSerializable", () => {
  it("accepts null and undefined", () => {
    expect(isSerializable(null)).toBe(true);
    expect(isSerializable(undefined)).toBe(true);
  });

  it("accepts primitives", () => {
    expect(isSerializable("hello")).toBe(true);
    expect(isSerializable(42)).toBe(true);
    expect(isSerializable(true)).toBe(true);
  });

  it("rejects functions", () => {
    expect(isSerializable(() => {})).toBe(false);
  });

  it("rejects symbols", () => {
    expect(isSerializable(Symbol("x"))).toBe(false);
  });

  it("accepts plain objects with serializable values", () => {
    expect(isSerializable({ a: 1, b: "two" })).toBe(true);
  });

  it("rejects objects with function values", () => {
    expect(isSerializable({ cb: () => {} })).toBe(false);
  });

  it("accepts arrays of primitives", () => {
    expect(isSerializable([1, "two", null])).toBe(true);
  });

  it("rejects arrays containing functions", () => {
    expect(isSerializable([1, () => {}])).toBe(false);
  });
});

describe("assertSerializableArgs", () => {
  it("passes for string args", () => {
    expect(() => assertSerializableArgs("svc", "method", ["hello", 42])).not.toThrow();
  });

  it("throws for function arg with descriptive message", () => {
    expect(() => assertSerializableArgs("svc", "method", [() => {}])).toThrow(
      /non-serializable argument at index 0.*function/,
    );
  });

  it("throws for nested object with function", () => {
    expect(() => assertSerializableArgs("svc", "method", [{ fn: () => {} }])).toThrow(
      /non-serializable argument at index 0/,
    );
  });

  it("mentions activations in error message", () => {
    expect(() => assertSerializableArgs("svc", "method", [Symbol("x")])).toThrow(/activations/);
  });
});
