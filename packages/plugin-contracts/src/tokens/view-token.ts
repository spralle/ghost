import type { z } from "zod";

/**
 * A typed view token binding a view definition ID to argument types via Zod schema.
 */
export interface ViewToken<TArgs extends z.ZodType> {
  readonly definitionId: string;
  readonly schema: TArgs;
  /** @internal Phantom — carries the args type. Never read at runtime. */
  readonly __args: z.infer<TArgs>;
}

/**
 * Creates a frozen view token binding a view definition ID to a Zod args schema.
 */
export function createViewToken<TArgs extends z.ZodType>(
  definitionId: string,
  schema: TArgs,
): ViewToken<TArgs> {
  if (!definitionId || typeof definitionId !== "string") {
    throw new Error("View token definition ID must be a non-empty string.");
  }
  return Object.freeze({
    definitionId,
    schema,
    __args: undefined as unknown as z.infer<TArgs>,
  });
}
