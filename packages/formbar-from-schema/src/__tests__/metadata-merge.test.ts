import { mergeMetadata, mergeSamePrecedence, SchemaError, structuralEqual } from "@ghost-shell/schema-core";
import { describe, expect, test } from "vitest";

describe("mergeMetadata (cross-precedence)", () => {
  test("external overrides embedded overrides kernel for scalars", () => {
    const result = mergeMetadata({
      kernelDefaults: { a: 1 },
      embedded: { a: 2 },
      external: { a: 3 },
    });
    expect(result).toEqual({ a: 3 });
  });

  test("undefined at higher precedence does not override", () => {
    const result = mergeMetadata({
      kernelDefaults: { a: 1, b: 2 },
      embedded: { a: undefined },
    });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test("null at higher precedence replaces lower", () => {
    const result = mergeMetadata({
      kernelDefaults: { a: 1 },
      embedded: { a: null },
    });
    expect(result).toEqual({ a: null });
  });

  test("objects deep merge across levels", () => {
    const result = mergeMetadata({
      kernelDefaults: { ui: { label: "Name", width: 100 } },
      embedded: { ui: { label: "Full Name" } },
    });
    expect(result).toEqual({ ui: { label: "Full Name", width: 100 } });
  });

  test("arrays replace wholesale (no concat)", () => {
    const result = mergeMetadata({
      kernelDefaults: { tags: [1, 2] },
      embedded: { tags: [3] },
    });
    expect(result).toEqual({ tags: [3] });
  });

  test("empty inputs produce empty result", () => {
    expect(mergeMetadata({})).toEqual({});
  });

  test("deeply nested merge", () => {
    const result = mergeMetadata({
      kernelDefaults: { a: { b: { c: 1, d: 2 } } },
      external: { a: { b: { c: 99 } } },
    });
    expect(result).toEqual({ a: { b: { c: 99, d: 2 } } });
  });

  test("mixed types across levels — higher scalar replaces lower object", () => {
    const result = mergeMetadata({
      kernelDefaults: { a: { nested: true } },
      external: { a: "flat" },
    });
    expect(result).toEqual({ a: "flat" });
  });
});

describe("mergeSamePrecedence (conflict detection)", () => {
  test("identical scalars are deduped", () => {
    expect(mergeSamePrecedence({ a: 1 }, { a: 1 })).toEqual({ a: 1 });
  });

  test("different scalars conflict", () => {
    expect(() => mergeSamePrecedence({ a: 1 }, { a: 2 })).toThrow(SchemaError);
    try {
      mergeSamePrecedence({ a: 1 }, { a: 2 });
    } catch (e) {
      expect((e as SchemaError).code).toBe("SCHEMA_META_CONFLICT");
    }
  });

  test("identical arrays are deduped", () => {
    expect(mergeSamePrecedence({ a: [1, 2] }, { a: [1, 2] })).toEqual({
      a: [1, 2],
    });
  });

  test("different arrays conflict", () => {
    expect(() => mergeSamePrecedence({ a: [1] }, { a: [2] })).toThrow(SchemaError);
  });

  test("object vs non-object conflicts", () => {
    expect(() => mergeSamePrecedence({ a: { x: 1 } }, { a: "string" })).toThrow(SchemaError);
  });

  test("object vs object merges recursively, conflict at child level", () => {
    expect(() => mergeSamePrecedence({ a: { x: 1 } }, { a: { x: 2 } })).toThrow(SchemaError);

    // Compatible nested merge
    expect(mergeSamePrecedence({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } });
  });

  test("both undefined keys are fine", () => {
    expect(mergeSamePrecedence({ a: undefined }, { a: undefined })).toEqual({});
  });

  test("one undefined uses the other", () => {
    expect(mergeSamePrecedence({ a: undefined }, { a: 1 })).toEqual({
      a: 1,
    });
  });
});

describe("structuralEqual", () => {
  test("primitives", () => {
    expect(structuralEqual(1, 1)).toBe(true);
    expect(structuralEqual(1, 2)).toBe(false);
    expect(structuralEqual("a", "a")).toBe(true);
    expect(structuralEqual(null, null)).toBe(true);
    expect(structuralEqual(null, 1)).toBe(false);
  });

  test("arrays", () => {
    expect(structuralEqual([1, 2], [1, 2])).toBe(true);
    expect(structuralEqual([1], [1, 2])).toBe(false);
  });

  test("objects", () => {
    expect(structuralEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(structuralEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(structuralEqual({ a: 1 }, { b: 1 })).toBe(false);
  });
});
