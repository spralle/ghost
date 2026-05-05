import { mergeMetadata, mergeSamePrecedence, SchemaError, structuralEqual } from "@ghost-shell/schema-core";
import { describe, expect, test } from "vitest";

/**
 * F5: Metadata merge conformance fixtures.
 * Verifies: precedence correct, deep merge works, array replace,
 * null/undefined rules, conflict detection.
 */

describe("F5: Metadata merge — precedence", () => {
  test("external > embedded > kernelDefaults", () => {
    const result = mergeMetadata({
      kernelDefaults: { x: "kernel" },
      embedded: { x: "embedded" },
      external: { x: "external" },
    });
    expect(result.x).toBe("external");
  });

  test("embedded > kernelDefaults when external absent", () => {
    const result = mergeMetadata({
      kernelDefaults: { x: "kernel" },
      embedded: { x: "embedded" },
    });
    expect(result.x).toBe("embedded");
  });

  test("kernelDefaults used when no overrides", () => {
    const result = mergeMetadata({
      kernelDefaults: { x: "kernel" },
    });
    expect(result.x).toBe("kernel");
  });
});

describe("F5: Metadata merge — deep merge", () => {
  test("nested objects merge across precedence levels", () => {
    const result = mergeMetadata({
      kernelDefaults: { ui: { label: "Name", width: 100, color: "red" } },
      embedded: { ui: { label: "Full Name", height: 50 } },
      external: { ui: { color: "blue" } },
    });
    expect(result).toEqual({
      ui: { label: "Full Name", width: 100, color: "blue", height: 50 },
    });
  });

  test("deeply nested (3+ levels) merge works", () => {
    const result = mergeMetadata({
      kernelDefaults: { a: { b: { c: { d: 1, e: 2 } } } },
      external: { a: { b: { c: { d: 99 } } } },
    });
    expect(result).toEqual({ a: { b: { c: { d: 99, e: 2 } } } });
  });
});

describe("F5: Metadata merge — array replace", () => {
  test("arrays replace wholesale, no concatenation", () => {
    const result = mergeMetadata({
      kernelDefaults: { tags: [1, 2, 3] },
      embedded: { tags: [4, 5] },
    });
    expect(result).toEqual({ tags: [4, 5] });
  });

  test("empty array replaces non-empty", () => {
    const result = mergeMetadata({
      kernelDefaults: { items: [1] },
      external: { items: [] },
    });
    expect(result).toEqual({ items: [] });
  });
});

describe("F5: Metadata merge — null/undefined rules", () => {
  test("null at higher precedence replaces lower value", () => {
    const result = mergeMetadata({
      kernelDefaults: { x: "value" },
      embedded: { x: null },
    });
    expect(result).toEqual({ x: null });
  });

  test("undefined at higher precedence does NOT override", () => {
    const result = mergeMetadata({
      kernelDefaults: { x: "value" },
      embedded: { x: undefined },
    });
    expect(result).toEqual({ x: "value" });
  });
});

describe("F5: Metadata merge — conflict detection (same precedence)", () => {
  test("identical values at same precedence are deduped", () => {
    const result = mergeSamePrecedence({ a: 1 }, { a: 1 });
    expect(result).toEqual({ a: 1 });
  });

  test("structurally equal objects at same precedence are deduped", () => {
    const result = mergeSamePrecedence({ config: { x: 1, y: [2, 3] } }, { config: { x: 1, y: [2, 3] } });
    expect(result).toEqual({ config: { x: 1, y: [2, 3] } });
  });

  test("different values at same precedence throw SCHEMA_META_CONFLICT", () => {
    try {
      mergeSamePrecedence({ a: 1 }, { a: 2 });
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaError);
      expect((e as SchemaError).code).toBe("SCHEMA_META_CONFLICT");
    }
  });

  test("different arrays at same precedence throw SCHEMA_META_CONFLICT", () => {
    expect(() => mergeSamePrecedence({ a: [1] }, { a: [2] })).toThrow(SchemaError);
  });

  test("non-overlapping keys merge without conflict", () => {
    const result = mergeSamePrecedence({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });
});

describe("F5: structuralEqual", () => {
  test("deep equality for nested structures", () => {
    expect(structuralEqual({ a: { b: [1, { c: true }] } }, { a: { b: [1, { c: true }] } })).toBe(true);
  });

  test("detects differences in nested structures", () => {
    expect(structuralEqual({ a: { b: [1, { c: true }] } }, { a: { b: [1, { c: false }] } })).toBe(false);
  });
});
