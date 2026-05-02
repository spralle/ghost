import type { z } from "zod";

/**
 * A typed intent token binding an intent ID to facts/result types via Zod schema.
 * Intents represent user-level goals that the shell resolves to concrete actions.
 */
export interface IntentToken<TFacts extends z.ZodType, TResult = void> {
  readonly id: string;
  readonly schema: TFacts;
  /** @internal Phantom — carries the facts type. Never read at runtime. */
  readonly __facts: z.infer<TFacts>;
  /** @internal Phantom — carries the result type. Never read at runtime. */
  readonly __result: TResult;
}

/**
 * Creates a frozen intent token binding an intent ID to a Zod facts schema.
 */
export function createIntentToken<TFacts extends z.ZodType, TResult = void>(
  id: string,
  schema: TFacts,
): IntentToken<TFacts, TResult> {
  if (!id || typeof id !== "string") {
    throw new Error("Intent token ID must be a non-empty string.");
  }
  return Object.freeze({
    id,
    schema,
    __facts: undefined as unknown as z.infer<TFacts>,
    __result: undefined as unknown as TResult,
  });
}
