import type { z } from "zod";

/**
 * A typed context token binding a context key to a value type.
 * Optionally carries a Zod schema for runtime validation.
 */
export interface ContextToken<T> {
  readonly id: string;
  readonly schema?: z.ZodType<T>;
  /** @internal Phantom — carries the value type. Never read at runtime. */
  readonly __type: T;
}

/**
 * Creates a frozen context token for a context key.
 * Optionally accepts a Zod schema for runtime validation.
 */
export function createContextToken<T>(id: string, schema?: z.ZodType<T>): ContextToken<T> {
  if (!id || typeof id !== "string") {
    throw new Error("Context token ID must be a non-empty string.");
  }
  return Object.freeze({
    id,
    schema,
    __type: undefined as unknown as T,
  });
}
