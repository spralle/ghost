import type { DotPaths, TypedQuery } from "@ghost-shell/predicate";

/** Extract element type from array (mutable or readonly) */
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

/** Keys of T whose value is an array of objects (not primitives) */
type ArrayObjectKeys<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends readonly (infer E)[]
    ? E extends object ? K : never
    : never;
}[keyof T & string];

/** Keys of T whose value is a self-referencing array (element has same key) */
type SelfRefKeys<T> = {
  [K in ArrayObjectKeys<T>]: K extends keyof ElementOf<NonNullable<T[K]>>
    ? K
    : never;
}[ArrayObjectKeys<T>];

/**
 * Filtered relation — distributive over K.
 * When you write `from: 'orderLines'`, TypeScript narrows $match and $project
 * to be typed against the element type of that array field.
 */
type FilteredRelation<T> = {
  [K in ArrayObjectKeys<T>]: {
    readonly from: K;
    readonly $match?: TypedQuery<ElementOf<NonNullable<T[K]>>>;
    readonly $project: DotPaths<ElementOf<NonNullable<T[K]>>>;
  };
}[ArrayObjectKeys<T>];

/**
 * Recursive relation — for self-referencing nested arrays.
 */
type RecursiveRelation<T> = {
  [K in SelfRefKeys<T>]: {
    readonly $recurse: K;
    readonly $project: DotPaths<ElementOf<NonNullable<T[K]>>>;
  };
}[SelfRefKeys<T>];

/**
 * Any valid relation for document type T.
 */
export type TypedRelation<T> =
  | DotPaths<T>
  | FilteredRelation<T>
  | RecursiveRelation<T>;

export type { ArrayObjectKeys, ElementOf, FilteredRelation, RecursiveRelation, SelfRefKeys };
