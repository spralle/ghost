import type { FieldMetaEntry } from "./state.js";

/**
 * Shift fieldMeta keys for array children after insert/remove.
 * delta = -1 for remove (drops entry at fromIndex, shifts subsequent down).
 * delta = +1 for insert (shifts entries at and after fromIndex up).
 */
export function shiftFieldMeta(
  fieldMeta: Readonly<Record<string, FieldMetaEntry>>,
  basePath: string,
  fromIndex: number,
  delta: number,
): Record<string, FieldMetaEntry> {
  const prefix = `${basePath}.`;
  const result: Record<string, FieldMetaEntry> = {};
  for (const [key, entry] of Object.entries(fieldMeta)) {
    if (!key.startsWith(prefix)) {
      result[key] = entry;
      continue;
    }
    const suffix = key.slice(prefix.length);
    const dotIdx = suffix.indexOf(".");
    const indexStr = dotIdx === -1 ? suffix : suffix.slice(0, dotIdx);
    const idx = Number(indexStr);
    if (Number.isNaN(idx)) {
      result[key] = entry;
      continue;
    }
    if (delta < 0 && idx === fromIndex) continue;
    if (idx >= fromIndex) {
      const newIdx = idx + delta;
      const rest = dotIdx === -1 ? "" : suffix.slice(dotIdx);
      result[`${basePath}.${newIdx}${rest}`] = entry;
    } else {
      result[key] = entry;
    }
  }
  return result;
}

/** Remove all fieldMeta entries that are children of basePath. */
export function clearChildFieldMeta(
  fieldMeta: Readonly<Record<string, FieldMetaEntry>>,
  basePath: string,
): Record<string, FieldMetaEntry> {
  const prefix = `${basePath}.`;
  const result: Record<string, FieldMetaEntry> = {};
  for (const [key, entry] of Object.entries(fieldMeta)) {
    if (!key.startsWith(prefix)) result[key] = entry;
  }
  return result;
}

/** Swap fieldMeta entries for two array indices under basePath. */
export function swapFieldMeta(
  fieldMeta: Readonly<Record<string, FieldMetaEntry>>,
  basePath: string,
  indexA: number,
  indexB: number,
): Record<string, FieldMetaEntry> {
  const prefixA = `${basePath}.${indexA}`;
  const prefixB = `${basePath}.${indexB}`;
  const result: Record<string, FieldMetaEntry> = {};
  for (const [key, entry] of Object.entries(fieldMeta)) {
    if (key === prefixA || key.startsWith(`${prefixA}.`)) {
      result[`${prefixB}${key.slice(prefixA.length)}`] = entry;
    } else if (key === prefixB || key.startsWith(`${prefixB}.`)) {
      result[`${prefixA}${key.slice(prefixB.length)}`] = entry;
    } else {
      result[key] = entry;
    }
  }
  return result;
}
