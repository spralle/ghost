import { structuredEqual } from "./equality.js";
import type { FieldMetaEntry, FormState } from "./state.js";

/** Convenience flag computations — pure functions over form state */

export function computeIsValid<TData, TUi>(state: FormState<TData, TUi>): boolean {
  return !state.issues.some((i) => i.severity === "error");
}

export function computeIsSubmitting<TData, TUi>(state: FormState<TData, TUi>): boolean {
  return state.meta.submission?.status === "running";
}

export function computeIsPristine<TData, TUi>(state: FormState<TData, TUi>, initialData: TData): boolean {
  return structuredEqual(state.data, initialData);
}

export function computeIsTouched<TData, TUi>(state: FormState<TData, TUi>): boolean {
  return Object.values(state.fieldMeta as Readonly<Record<string, FieldMetaEntry>>).some((m) => m.touched);
}
