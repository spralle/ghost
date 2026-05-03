import type { ResourceSchema } from "../schema/define-resource";

export interface RedactContext {
  readonly grantedBlocks: readonly string[];
}

/**
 * Strip fields from a document based on data block grants.
 * Returns a deep clone with only fields from granted blocks.
 */
export function redact<T extends Record<string, unknown>>(
  document: T,
  schema: ResourceSchema<unknown, string>,
  context: RedactContext,
): Partial<T> {
  const allowedPaths = collectAllowedPaths(schema, context.grantedBlocks);

  // If no data blocks defined, return full clone
  if (Object.keys(schema.dataBlocks).length === 0) {
    return structuredClone(document);
  }

  // If no granted blocks, return empty
  if (context.grantedBlocks.length === 0) {
    return {};
  }

  return pickPaths(document, allowedPaths) as Partial<T>;
}

/** Collect all allowed top-level field paths from granted blocks */
function collectAllowedPaths(
  schema: ResourceSchema<unknown, string>,
  grantedBlocks: readonly string[],
): Set<string> {
  const paths = new Set<string>();

  for (const blockName of grantedBlocks) {
    const block = schema.dataBlocks[blockName];
    if (!block) continue;
    for (const field of block.fields) {
      paths.add(field as string);
    }
  }

  return paths;
}

/** Pick only allowed paths from document (top-level dot-path support) */
function pickPaths(
  document: Record<string, unknown>,
  allowedPaths: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const path of allowedPaths) {
    const value = getNestedValue(document, path);
    if (value !== undefined) {
      setNestedValue(result, path, structuredClone(value));
    }
  }

  return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
