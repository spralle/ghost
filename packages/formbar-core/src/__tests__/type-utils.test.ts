import { describe, expect, it } from "vitest";
import type { DeepKeys, DeepValue } from "../type-utils.js";

// Compile-time type assertions (no runtime overhead)
type Assert<T extends true> = T;
type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// --- DeepKeys tests ---

// Simple object
type _K1 = Assert<IsEqual<DeepKeys<{ a: string; b: number }>, "a" | "b">>;

// Nested object
type _K2 = Assert<IsEqual<DeepKeys<{ a: { b: string } }>, "a" | "a.b">>;

// Array paths
type _K3 = Assert<IsEqual<DeepKeys<{ items: string[] }>, "items" | `items.${number}`>>;

// Array of objects
type _K4 = Assert<IsEqual<DeepKeys<{ items: { id: number }[] }>, "items" | `items.${number}` | `items.${number}.id`>>;

// Optional fields
type _K5 = Assert<IsEqual<DeepKeys<{ a?: { b: string } }>, "a" | "a.b">>;

// Nullable fields
type _K6 = Assert<IsEqual<DeepKeys<{ a: { b: string } | null }>, "a" | "a.b">>;

// biome-ignore lint/complexity/noBannedTypes: intentionally testing empty object type behavior
type _K7 = Assert<IsEqual<DeepKeys<{}>, never>>;

// unknown input returns string
type _K8 = Assert<IsEqual<DeepKeys<unknown>, string>>;

// --- DeepValue tests ---

type _V1 = Assert<IsEqual<DeepValue<{ a: { b: string } }, "a.b">, string>>;
type _V2 = Assert<IsEqual<DeepValue<{ a: { b: string } }, "a">, { b: string }>>;
type _V3 = Assert<IsEqual<DeepValue<{ items: string[] }, `items.${number}`>, string>>;

// Optional field includes undefined
type _V4 = Assert<IsEqual<DeepValue<{ a?: { b: string } }, "a.b">, string | undefined>>;

// --- Depth limit test (15 levels deep — must not crash tsc) ---
type Deep15 = {
  a: { a: { a: { a: { a: { a: { a: { a: { a: { a: { a: { a: { a: { a: { a: string } } } } } } } } } } } } } };
};
type _KDeep = DeepKeys<Deep15>; // Should compile without hanging

describe("type-utils", () => {
  it("compiles without errors (runtime placeholder)", () => {
    expect(true).toBe(true);
  });
});
