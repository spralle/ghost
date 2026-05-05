/**
 * Deep path and value type utilities for formbar.
 * Types-only — no runtime code.
 */

/** Detects the `unknown`-like top type to prevent type pollution in recursive utilities. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** Expands intersection types for readability in IDE tooltips. */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Recursive string literal union of all valid dot-notation paths into type `T`.
 *
 * Handles nested objects, arrays, optionals, nullables, and Records.
 * Depth-limited to 10 levels to prevent infinite recursion.
 */
export type DeepKeys<T, Depth extends unknown[] = []> = Depth["length"] extends 10
  ? never
  : IsAny<T> extends true
    ? string
    : unknown extends T
      ? string
      : T extends readonly unknown[]
        ? DeepArrayKeys<T, Depth>
        : T extends object
          ? string extends keyof T
            ? string // Record<string, V> — stop recursion
            : { [K in keyof T & string]: K | `${K}.${DeepKeys<NonNullable<T[K]>, [...Depth, unknown]>}` }[keyof T &
                string]
          : never;

type DeepArrayKeys<T extends readonly unknown[], Depth extends unknown[]> =
  | `${number}`
  | `${number}.${DeepKeys<NonNullable<T[number]>, [...Depth, unknown]>}`;

/**
 * Resolves the TypeScript type at dot-notation path `P` within `T`.
 *
 * Handles nested objects, arrays, optionals, and nullables.
 */
export type DeepValue<T, P> =
  IsAny<T> extends true
    ? unknown
    : P extends `${infer Head}.${infer Tail}`
      ? Head extends keyof NonNullable<T>
        ? DeepValue<NonNullable<T>[Head], Tail> | ExtractUndefined<T>
        : Head extends `${number}`
          ? NonNullable<T> extends readonly unknown[]
            ? DeepValue<NonNullable<T>[number], Tail> | ExtractUndefined<T>
            : undefined
          : undefined
      : P extends keyof NonNullable<T>
        ? NonNullable<T>[P] | ExtractUndefined<T>
        : P extends `${number}`
          ? NonNullable<T> extends readonly unknown[]
            ? NonNullable<T>[number] | ExtractUndefined<T>
            : undefined
          : undefined;

/** Extracts `undefined` from T if T is optional/nullable (includes undefined or null). */
type ExtractUndefined<T> = undefined extends T ? undefined : null extends T ? undefined : never;

/** Extracts the element type from an array type, or `never` if not an array. */
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;
