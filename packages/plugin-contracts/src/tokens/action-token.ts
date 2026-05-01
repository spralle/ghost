import type { z } from "zod";

/**
 * A typed action token binding an action ID to argument/result types via Zod schema.
 * The schema is stored at runtime for validation/introspection.
 * Phantom fields carry types at compile time but don't exist at runtime.
 */
export interface ActionToken<TArgs extends z.ZodType, TResult = void> {
  readonly id: string;
  readonly schema: TArgs;
  /** @internal Phantom — carries the args type. Never read at runtime. */
  readonly __args: z.infer<TArgs>;
  /** @internal Phantom — carries the result type. Never read at runtime. */
  readonly __result: TResult;
}

/**
 * Creates a frozen action token binding an action ID to a Zod args schema.
 */
export function createActionToken<TArgs extends z.ZodType, TResult = void>(
  id: string,
  schema: TArgs,
): ActionToken<TArgs, TResult> {
  if (!id || typeof id !== "string") {
    throw new Error("Action token ID must be a non-empty string.");
  }
  return Object.freeze({
    id,
    schema,
    __args: undefined as unknown as z.infer<TArgs>,
    __result: undefined as unknown as TResult,
  });
}
