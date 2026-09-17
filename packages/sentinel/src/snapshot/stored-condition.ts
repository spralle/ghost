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
  distinctNodes: number;
}

interface OperatorValidationContext {
  readonly fieldConditions: WeakMap<object, boolean>;
  readonly logicalArrays: WeakMap<object, boolean>;
  readonly queries: WeakMap<object, boolean>;
  visits: number;
}

export const STORED_CONDITION_COMPILE_NODE_BUDGET = 10_000;

type ValueNormalization = { readonly ok: true; readonly value: unknown } | { readonly ok: false };
type ObjectNormalization = { readonly ok: true; readonly value: Record<string, unknown> } | { readonly ok: false };
export type StoredConditionNormalization =
  | {
      readonly ok: true;
      readonly condition: Record<string, unknown>;
      readonly complexity: StoredConditionComplexity;
    }
  | {
      readonly ok: false;
      readonly reason: "complexity-budget" | "invalid-condition";
      readonly complexity?: StoredConditionComplexity;
    };

export interface StoredConditionComplexity {
  readonly distinctNodes: number;
  readonly expandedNodes: number;
  readonly operatorVisits: number;
}

/** Validate and detach plain condition data without invoking accessors. */
export function normalizeStoredCondition(value: unknown): StoredConditionNormalization {
  try {
    if (!isPlainObject(value)) return { ok: false, reason: "invalid-condition" };
    const context = { active: new WeakSet<object>(), clones: new WeakMap<object, unknown>(), distinctNodes: 0 };
    const normalized = normalizeObject(value, context);
    if (!normalized.ok) return { ok: false, reason: "invalid-condition" };
    const operators = createOperatorValidationContext();
    if (!usesKnownOperators(normalized.value, operators)) return { ok: false, reason: "invalid-condition" };
    const expandedNodes = measureExpandedNodes(normalized.value, new WeakMap<object, number>());
    const complexity = { distinctNodes: context.distinctNodes, expandedNodes, operatorVisits: operators.visits };
    if (expandedNodes > STORED_CONDITION_COMPILE_NODE_BUDGET) {
      return { ok: false, reason: "complexity-budget", complexity };
    }
    if (!compiles(normalized.value)) return { ok: false, reason: "invalid-condition", complexity };
    return { ok: true, condition: normalized.value, complexity };
  } catch {
    return { ok: false, reason: "invalid-condition" };
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
  context.distinctNodes += 1;
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
  context.distinctNodes += 1;
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

function createOperatorValidationContext(): OperatorValidationContext {
  return {
    fieldConditions: new WeakMap<object, boolean>(),
    logicalArrays: new WeakMap<object, boolean>(),
    queries: new WeakMap<object, boolean>(),
    visits: 0,
  };
}

function usesKnownOperators(query: Record<string, unknown>, context: OperatorValidationContext): boolean {
  const cached = context.queries.get(query);
  if (cached !== undefined) return cached;
  context.visits += 1;
  context.queries.set(query, true);
  const valid = Object.entries(query).every(([key, value]) =>
    key.startsWith("$") ? isValidLogicalOperator(key, value, context) : isValidFieldCondition(value, context),
  );
  context.queries.set(query, valid);
  return valid;
}

function isValidLogicalOperator(operator: string, value: unknown, context: OperatorValidationContext): boolean {
  if (!LOGICAL_OPERATORS.has(operator)) return false;
  if (operator === "$not") return isPlainObject(value) && usesKnownOperators(value, context);
  if (!Array.isArray(value)) return false;
  const cached = context.logicalArrays.get(value);
  if (cached !== undefined) return cached;
  context.visits += 1;
  const valid = value.every((entry) => isPlainObject(entry) && usesKnownOperators(entry, context));
  context.logicalArrays.set(value, valid);
  return valid;
}

function isValidFieldCondition(value: unknown, context: OperatorValidationContext): boolean {
  if (!isPlainObject(value)) return true;
  const cached = context.fieldConditions.get(value);
  if (cached !== undefined) return cached;
  context.visits += 1;
  const keys = Object.keys(value);
  if (!keys.every((key) => key.startsWith("$"))) {
    context.fieldConditions.set(value, true);
    return true;
  }
  const valid = keys.every(
    (operator) => FIELD_OPERATORS.has(operator) && isValidNestedFieldOperator(operator, value[operator], context),
  );
  context.fieldConditions.set(value, valid);
  return valid;
}

function isValidNestedFieldOperator(operator: string, value: unknown, context: OperatorValidationContext): boolean {
  if (operator === "$elemMatch") return isPlainObject(value) && usesKnownOperators(value, context);
  if (operator !== "$not") return true;
  return isPlainObject(value) && isValidFieldCondition(value, context);
}

function measureExpandedNodes(value: unknown, memo: WeakMap<object, number>): number {
  if (typeof value !== "object" || value === null) return 1;
  const cached = memo.get(value);
  if (cached !== undefined) return cached;
  let total = 1;
  for (const child of Object.values(value)) {
    total = boundedComplexitySum(total, measureExpandedNodes(child, memo));
    if (total > STORED_CONDITION_COMPILE_NODE_BUDGET) break;
  }
  memo.set(value, total);
  return total;
}

function boundedComplexitySum(total: number, addition: number): number {
  const overflow = STORED_CONDITION_COMPILE_NODE_BUDGET + 1;
  if (total >= overflow || addition >= overflow || total > STORED_CONDITION_COMPILE_NODE_BUDGET - addition) {
    return overflow;
  }
  return total + addition;
}

function compiles(condition: Record<string, unknown>): boolean {
  try {
    compile(condition);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
