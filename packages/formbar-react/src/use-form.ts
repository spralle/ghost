import type { CreateFormOptions, FormApi, SubmitResult } from "@formbar/core";
import { createForm } from "@formbar/core";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { focusFirstError } from "./a11y.js";

/** Options for useForm, extending core CreateFormOptions with React-specific behavior */
export interface UseFormOptions<TData, TUi> extends CreateFormOptions<TData, TUi> {
  /** Auto-focus the first error field on submit failure (default: true) */
  readonly autoFocusOnError?: boolean;
}

export function useForm<TData, TUi>(options?: UseFormOptions<TData, TUi>): FormApi<TData, TUi> {
  const autoFocus = options?.autoFocusOnError ?? true;
  const formRef = useRef<FormApi<TData, TUi> | null>(null);
  const disposeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (formRef.current === null) {
    formRef.current = createForm<TData, TUi>(options);
  }

  const form = formRef.current;

  // Adapt form.subscribe (which passes state) to useSyncExternalStore's expected signature
  const subscribe = useRef((onStoreChange: () => void) => {
    return form.subscribe(onStoreChange);
  }).current;

  useSyncExternalStore(subscribe, () => form.getState());

  // Deferred disposal: schedule dispose in a macrotask so StrictMode remount can cancel it
  useEffect(() => {
    if (disposeTimerRef.current !== null) {
      clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }
    return () => {
      disposeTimerRef.current = setTimeout(() => {
        formRef.current?.dispose();
      }, 0);
    };
  }, []);

  // Wrap the form API to auto-focus on submit errors (ADR §12)
  const wrappedApi = useMemo((): FormApi<TData, TUi> => {
    if (!autoFocus) return form;

    return {
      ...form,
      submit: async (...args: Parameters<FormApi<TData, TUi>["submit"]>): Promise<SubmitResult> => {
        const result = await form.submit(...args);
        if (!result.ok && result.fieldIssues?.length) {
          focusFirstError(result.fieldIssues);
        }
        return result;
      },
    };
  }, [form, autoFocus]);

  return wrappedApi;
}
