import { redact } from "@sentinel-guard/core";
import type { ResourceSchema } from "@sentinel-guard/core";
import type { RedactionContext, RedactionHook } from "./types.js";

/**
 * Create a redaction hook that strips document fields per dataBlock grants.
 */
export function createRedactionHook<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): RedactionHook<T> {
  return (
    documents: readonly T[],
    schema: ResourceSchema<unknown, string>,
    context: RedactionContext,
  ): Partial<T>[] => {
    return documents.map((doc) =>
      redact(doc, schema, { grantedBlocks: context.grantedBlocks }),
    );
  };
}
