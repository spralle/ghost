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

/** Return whether a stored condition is plain JSON accepted by Kuery. */
export function isStoredCondition(value: unknown): value is Record<string, unknown> {
  if (!isPlainJsonObject(value) || !usesKnownOperators(value)) return false;
  try {
    compile(value);
    return true;
  } catch {
    return false;
  }
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && isJsonContainer(value, new WeakSet<object>());
}

function isJsonContainer(value: unknown, ancestors: WeakSet<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  if (!Array.isArray(value) && !isPlainObject(value)) return false;

  ancestors.add(value);
  const valid = Object.values(value).every((entry) => isJsonContainer(entry, ancestors));
  ancestors.delete(value);
  return valid;
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
