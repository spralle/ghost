import { compile } from "kuery/compile";

const LOGICAL_OPERATORS = new Set(["$and", "$or", "$nor", "$not"]);
const FIELD_OPERATORS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$exists",
  "$regex",
  "$options",
  "$all",
  "$size",
  "$not",
  "$elemMatch",
]);

interface NormalizationContext {
  readonly active: WeakSet<object>;
  readonly clones: WeakMap<object, unknown>;
}

type ValueNormalization = { readonly ok: true; readonly value: unknown } | { readonly ok: false };
type ObjectNormalization = { readonly ok: true; readonly value: Record<string, unknown> } | { readonly ok: false };
export type StoredConditionNormalization =
  | { readonly ok: true; readonly condition: Record<string, unknown> }
  | { readonly ok: false };

/** Validate and detach plain condition data without invoking accessors. */
export function normalizeStoredCondition(value: unknown): StoredConditionNormalization {
  try {
    if (!isPlainObject(value)) return { ok: false };
    const context = { active: new WeakSet<object>(), clones: new WeakMap<object, unknown>() };
    const normalized = normalizeObject(value, context);
    if (!normalized.ok || !usesKnownOperators(normalized.value)) return { ok: false };
    compile(normalized.value);
    return { ok: true, condition: normalized.value };
  } catch {
    return { ok: false };
  }
}

export function isStoredCondition(value: unknown): value is Record<string, unknown> {
  return normalizeStoredCondition(value).ok;
}

function normalizeValue(value: unknown, context: NormalizationContext): ValueNormalization {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  if (typeof value !== "object") return { ok: false };
  if (context.active.has(value)) return { ok: false };
  const existing = context.clones.get(value);
  if (existing !== undefined) return { ok: true, value: existing };
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return { ok: false };
    return normalizeArray(value, context);
  }
  if (isPlainObject(value)) return normalizeObject(value, context);
  return { ok: false };
}

function normalizeObject(value: Record<string, unknown>, context: NormalizationContext): ObjectNormalization {
  const descriptors = readSafeObjectDescriptors(value);
  if (descriptors === undefined) return { ok: false };
  const clone: Record<string, unknown> = {};
  context.clones.set(value, clone);
  context.active.add(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    const normalized = normalizeValue(descriptor.value, context);
    if (!normalized.ok) return { ok: false };
    Object.defineProperty(clone, key, safeDataDescriptor(normalized.value));
  }
  context.active.delete(value);
  return { ok: true, value: clone };
}

function normalizeArray(value: unknown[], context: NormalizationContext): ValueNormalization {
  const length = readSafeArrayLength(value);
  if (length === undefined) return { ok: false };
  const clone: unknown[] = [];
  context.clones.set(value, clone);
  context.active.add(value);
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!isSafeDataDescriptor(descriptor)) return { ok: false };
    const normalized = normalizeValue(descriptor.value, context);
    if (!normalized.ok) return { ok: false };
    clone.push(normalized.value);
  }
  context.active.delete(value);
  return { ok: true, value: clone };
}

function readSafeObjectDescriptors(value: object): PropertyDescriptorMap | undefined {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of keys) {
    if (typeof key !== "string" || !isSafeDataDescriptor(descriptors[key])) return undefined;
  }
  return descriptors;
}

function readSafeArrayLength(value: unknown[]): number | undefined {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) return undefined;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!isStandardArrayLength(length) || keys.length !== length.value + 1) return undefined;
  for (let index = 0; index < length.value; index += 1) {
    if (!isSafeDataDescriptor(Object.getOwnPropertyDescriptor(value, String(index)))) return undefined;
  }
  return length.value;
}

function isSafeDataDescriptor(descriptor: PropertyDescriptor | undefined): descriptor is PropertyDescriptor & {
  value: unknown;
} {
  return Boolean(
    descriptor && "value" in descriptor && descriptor.enumerable && descriptor.configurable && descriptor.writable,
  );
}

function isStandardArrayLength(descriptor: PropertyDescriptor | undefined): descriptor is PropertyDescriptor & {
  value: number;
} {
  return Boolean(
    descriptor &&
      "value" in descriptor &&
      typeof descriptor.value === "number" &&
      Number.isSafeInteger(descriptor.value) &&
      descriptor.value >= 0 &&
      !descriptor.enumerable &&
      !descriptor.configurable &&
      descriptor.writable,
  );
}

function safeDataDescriptor(value: unknown): PropertyDescriptor {
  return { value, enumerable: true, configurable: true, writable: true };
}

function usesKnownOperators(query: Record<string, unknown>): boolean {
  return Object.entries(query).every(([key, value]) =>
    key.startsWith("$") ? isValidLogicalOperator(key, value) : isValidFieldCondition(value),
  );
}

function isValidLogicalOperator(operator: string, value: unknown): boolean {
  if (!LOGICAL_OPERATORS.has(operator)) return false;
  if (operator === "$not") return isPlainObject(value) && usesKnownOperators(value);
  return Array.isArray(value) && value.every((entry) => isPlainObject(entry) && usesKnownOperators(entry));
}

function isValidFieldCondition(value: unknown): boolean {
  if (!isPlainObject(value)) return true;
  const keys = Object.keys(value);
  if (!keys.every((key) => key.startsWith("$"))) return true;
  return keys.every(
    (operator) => FIELD_OPERATORS.has(operator) && isValidNestedFieldOperator(operator, value[operator]),
  );
}

function isValidNestedFieldOperator(operator: string, value: unknown): boolean {
  if (operator === "$elemMatch") return isPlainObject(value) && usesKnownOperators(value);
  if (operator !== "$not") return true;
  return isPlainObject(value) && isValidFieldCondition(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
