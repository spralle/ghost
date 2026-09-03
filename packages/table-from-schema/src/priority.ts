import type { SchemaFieldInfo } from "@scheman/core";
import type { ColumnPriority } from "./types.js";

const ID_SUFFIX_RE = /(?:^id$|Id$|_id$|^uuid$|Uuid$)/;
const LONG_TEXT_KEYS = /description|bio|notes|comment|body/i;
const LONG_TEXT_THRESHOLD = 200;

/**
 * Infer a column's display priority from its schema field and position.
 *
 * Heuristics:
 * - First string field is typically a name/title → essential
 * - ID/UUID fields are rarely user-facing → optional
 * - Long-text or description-like fields → optional
 * - Everything else → default
 */
export function inferPriority(field: SchemaFieldInfo, index: number): ColumnPriority {
  if (index === 0 && field.type === "string") {
    return "essential";
  }

  if (ID_SUFFIX_RE.test(field.path)) {
    return "optional";
  }

  if (isLongTextField(field)) {
    return "optional";
  }

  return "default";
}

function isLongTextField(field: SchemaFieldInfo): boolean {
  if (LONG_TEXT_KEYS.test(field.path)) return true;
  if (field.type === "string" && field.metadata?.maxLength != null && field.metadata.maxLength > LONG_TEXT_THRESHOLD) {
    return true;
  }
  return false;
}
