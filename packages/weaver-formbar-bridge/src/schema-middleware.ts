import type { JsonSchema, SchemaMiddleware } from "@ghost-shell/schema-core";

export interface WeaverFormbarContext {
  readonly layer: string;
  readonly layerRank: number;
  readonly layerRanks: ReadonlyMap<string, number>;
  readonly authRoles: readonly string[];
  readonly sessionActive?: boolean;
}

interface WeaverExtension {
  readonly sensitive?: boolean;
  readonly maxOverrideLayer?: string;
  readonly changePolicy?: string;
  readonly visibility?: string;
}

/**
 * Pre-ingestion schema middleware that reads x-weaver annotations
 * and injects x-formbar rendering hints for the form layer.
 */
export function weaverToFormbarMiddleware(context: WeaverFormbarContext): SchemaMiddleware {
  return (schema: JsonSchema): JsonSchema => walkSchema(schema, context);
}

function walkSchema(schema: JsonSchema, context: WeaverFormbarContext): JsonSchema {
  let result = schema;

  if (schema.properties !== undefined) {
    const transformed: Record<string, JsonSchema> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      transformed[key] = walkSchema(prop, context);
    }
    result = { ...result, properties: transformed };
  }

  const weaver = schema["x-weaver"] as WeaverExtension | undefined;
  if (weaver === undefined) {
    return result;
  }

  const hints = buildFormbarHints(weaver, context);
  if (Object.keys(hints).length === 0) {
    return result;
  }

  const existing = (result["x-formbar"] ?? {}) as Readonly<Record<string, unknown>>;
  return { ...result, "x-formbar": { ...existing, ...hints } };
}

function buildFormbarHints(weaver: WeaverExtension, context: WeaverFormbarContext): Record<string, unknown> {
  const hints: Record<string, unknown> = {};

  if (weaver.sensitive === true) {
    hints.widget = "password";
  }

  if (weaver.maxOverrideLayer !== undefined) {
    const ceilingRank = context.layerRanks.get(weaver.maxOverrideLayer);
    if (ceilingRank !== undefined && context.layerRank > ceilingRank) {
      hints.readOnly = true;
    }
  }

  if (weaver.changePolicy !== undefined && weaver.changePolicy !== "direct-allowed") {
    if (context.sessionActive !== true) {
      hints.readOnly = true;
    }
  }

  if (weaver.visibility !== undefined) {
    if (!context.authRoles.includes(weaver.visibility)) {
      hints.hidden = true;
    }
  }

  return hints;
}
