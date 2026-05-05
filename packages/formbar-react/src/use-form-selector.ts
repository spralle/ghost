import type { FormApi, FormState } from "@formbar/core";
import { useCallback, useRef, useSyncExternalStore } from "react";

/** Subscribe to a derived value from form state; only re-render when the selected value changes */
export function useFormSelector<TData, TUi, T>(
  form: FormApi<TData, TUi>,
  selector: (state: FormState<TData, TUi>) => T,
  equalityFn?: (prev: T, next: T) => boolean,
): T {
  const eqRef = useRef(equalityFn ?? Object.is);
  eqRef.current = equalityFn ?? Object.is;

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const prevRef = useRef<{ readonly value: T; readonly initialized: boolean }>({
    value: undefined as T,
    initialized: false,
  });

  const subscribe = useCallback((onStoreChange: () => void) => form.subscribe(onStoreChange), [form]);

  const getSnapshot = useCallback((): T => {
    const next = selectorRef.current(form.getState());
    if (prevRef.current.initialized && eqRef.current(prevRef.current.value, next)) {
      return prevRef.current.value;
    }
    prevRef.current = { value: next, initialized: true };
    return next;
  }, [form]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
