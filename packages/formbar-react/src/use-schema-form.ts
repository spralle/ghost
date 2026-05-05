import type { FormApi, ValidatorFn } from "@formbar/core";
import type { LayoutNode, SchemaFieldInfo, SchemaMetadata } from "@formbar/from-schema";
import { createSchemaForm } from "@formbar/from-schema";
import { useMemo } from "react";
import type { ResolvedFieldState } from "./resolve-field-state.js";
import { pruneHiddenFields, resolveFieldStates } from "./resolve-field-state.js";
import type { UseFormOptions } from "./use-form.js";
import { useForm } from "./use-form.js";
import { useFormSelector } from "./use-form-selector.js";

export interface UseSchemaFormOptions<TData, TUi> extends Omit<UseFormOptions<TData, TUi>, "validators"> {
  readonly validators?: readonly ValidatorFn[];
  readonly layoutOverride?: LayoutNode;
}

export interface UseSchemaFormResult<TData, TUi> {
  readonly form: FormApi<TData, TUi>;
  readonly fields: readonly SchemaFieldInfo[];
  readonly layout: LayoutNode;
  readonly metadata: SchemaMetadata;
  readonly fieldStates: ReadonlyMap<string, ResolvedFieldState>;
}

/** Stable empty fallback — avoids creating a new object when no uiState exists */
const EMPTY_UI_STATE: Readonly<Record<string, unknown>> = Object.freeze({});

/** Shallow comparison for string-keyed records to stabilize uiState references */
function shallowEqualRecord(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * React lifecycle wrapper over createSchemaForm.
 * Memoizes schema preparation; wires validators into useForm.
 * Resolves arbiter $ui field state and prunes hidden fields from layout.
 */
export function useSchemaForm<TData, TUi>(
  schema: unknown,
  options?: UseSchemaFormOptions<TData, TUi>,
): UseSchemaFormResult<TData, TUi> {
  const prepared = useMemo(
    () =>
      createSchemaForm(schema, {
        layoutOverride: options?.layoutOverride,
        validators: options?.validators,
      }),
    [schema, options?.layoutOverride, options?.validators],
  );

  const mergedInitialData = useMemo(() => {
    if (Object.keys(prepared.defaults).length === 0) return options?.initialData;
    return { ...prepared.defaults, ...(options?.initialData ?? {}) } as TData;
  }, [prepared.defaults, options?.initialData]);

  const form = useForm<TData, TUi>({
    ...options,
    schema,
    initialData: mergedInitialData,
    validators: prepared.validators,
  });

  const fieldPaths = useMemo(() => prepared.fields.map((f: SchemaFieldInfo) => f.path), [prepared.fields]);

  // Select uiState with shallow equality to avoid recomputing fieldStates every render.
  // FormState.uiState is typed as TUi; we treat it as a string-keyed record for arbiter lookups.
  const uiState = useFormSelector(
    form,
    (state) => (state.uiState ?? EMPTY_UI_STATE) as Readonly<Record<string, unknown>>,
    shallowEqualRecord,
  );

  const fieldStates = useMemo(() => resolveFieldStates(uiState, fieldPaths), [uiState, fieldPaths]);

  const layout = useMemo(
    () => pruneHiddenFields(prepared.layout, fieldStates) ?? { ...prepared.layout, children: [] },
    [prepared.layout, fieldStates],
  );

  return {
    form,
    fields: prepared.fields,
    layout,
    metadata: prepared.metadata,
    fieldStates,
  };
}
