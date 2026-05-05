import type { FieldApi, FieldConfig, FieldMetaEntry, FormApi } from "@formbar/core";
import { useMemo, useRef } from "react";
import { useFormSelector } from "./use-form-selector.js";

interface FieldSnapshot {
  readonly value: unknown;
  readonly meta: FieldMetaEntry | undefined;
}

function fieldSnapshotEqual(a: FieldSnapshot, b: FieldSnapshot): boolean {
  return a.value === b.value && a.meta === b.meta;
}

/**
 * React hook that subscribes to a specific field with fine-grained re-rendering.
 * Only re-renders when the field's value or metadata actually changes.
 *
 * @param form - The {@link FormApi} instance (from useForm or createForm).
 * @param path - Dot-path to the field (e.g., `"user.email"`).
 * @param config - Optional field configuration (label, validators, triggers).
 * @returns A {@link FieldApi} with reactive get/set, validation, and touch tracking.
 *
 * @example
 * ```typescript
 * function EmailField({ form }) {
 *   const field = useField(form, "email");
 *   return (
 *     <div>
 *       <input
 *         value={field.get() ?? ""}
 *         onChange={e => field.handleChange(e.target.value)}
 *         onBlur={() => field.handleBlur()}
 *       />
 *       {field.issues().map(i => <span key={i.code}>{i.message}</span>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useField<TData, TUi, P extends string>(
  form: FormApi<TData, TUi>,
  path: P,
  config?: FieldConfig,
): FieldApi<TData, TUi, P> {
  // Stabilize config reference — inline objects create new references every render
  const configRef = useRef(config);
  const stableConfig = useMemo(() => {
    const prev = configRef.current;
    if (prev === config) return prev;
    if (prev && config && JSON.stringify(prev) === JSON.stringify(config)) return prev;
    configRef.current = config;
    return config;
  }, [config]);

  const field = useMemo(() => form.fieldDynamic(path, stableConfig), [form, path, stableConfig]);

  // Subscribe to field value and touched state to trigger re-renders
  useFormSelector(
    form,
    () => {
      const state = form.getState();
      const pathKey = field.path.segments.join(".");
      const meta = (state.fieldMeta as Readonly<Record<string, FieldMetaEntry>>)[pathKey];
      return { value: field.get(), meta } as FieldSnapshot;
    },
    fieldSnapshotEqual,
  );

  return field as FieldApi<TData, TUi, P>;
}
