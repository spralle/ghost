import { FormbarError } from "./errors.js";

export function setNestedValue(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown,
): Record<string, unknown> {
  const filtered = segments.filter((s) => s !== "");
  if (filtered.length === 0) {
    throw new FormbarError("FORMBAR_PATH_EMPTY", "Cannot set value at empty path");
  }
  if (filtered.length === 1) {
    return { ...obj, [filtered[0]]: value };
  }
  const [head, ...rest] = filtered;
  const nextIsNumeric = /^(?:0|[1-9]\d*)$/.test(rest[0]);
  const existing = obj[head];
  const child = existing ?? (nextIsNumeric ? [] : {});
  if (Array.isArray(child)) {
    const arr = [...child];
    const idx = Number(rest[0]);
    if (rest.length === 1) {
      arr[idx] = value;
    } else {
      const inner = (arr[idx] ?? {}) as Record<string, unknown>;
      arr[idx] = setNestedValue(inner, rest.slice(1), value);
    }
    return { ...obj, [head]: arr };
  }
  return { ...obj, [head]: setNestedValue(child as Record<string, unknown>, rest, value) };
}

export function deleteNestedValue(obj: Record<string, unknown>, segments: string[]): Record<string, unknown> {
  const filtered = segments.filter((s) => s !== "");
  if (filtered.length === 0) {
    throw new FormbarError("FORMBAR_PATH_EMPTY", "Cannot delete value at empty path");
  }
  if (filtered.length === 1) {
    const { [filtered[0]]: _, ...rest } = obj;
    return rest;
  }
  const [head, ...rest] = filtered;
  const child = obj[head];
  if (child === null || child === undefined || typeof child !== "object") return obj;
  return { ...obj, [head]: deleteNestedValue(child as Record<string, unknown>, rest) };
}
