import {
  type ArbiterFormAdapter,
  createArbiterAdapter,
  createArbiterAdapterFromSession,
} from "./arbiter-integration.js";
import { createAsyncValidationManager } from "./async-validation.js";
import type {
  FieldApi,
  FieldConfig,
  FormAction,
  FormApi,
  FormDispatchResult,
  Middleware,
  ValidatorFn,
} from "./contracts.js";
import { computeIsPristine, computeIsSubmitting, computeIsTouched, computeIsValid } from "./convenience-flags.js";
import { FormbarError } from "./errors.js";
import { createFieldApi } from "./field-api.js";
import { createListenerRegistry } from "./listener-registry.js";
import { disposeMiddlewares, initMiddlewares } from "./middleware-runner.js";
import type { CanonicalPath } from "./path.js";
import { parsePath } from "./path-parser.js";
import { executePipeline } from "./pipeline.js";
import { createStandardSchemaValidator, isStandardSchemaLike } from "./standard-schema.js";
import type { CreateFormOptions, FieldMetaEntry, FormState, ValidationIssue } from "./state.js";
import { FormStore } from "./store.js";
import { createSubmitHandler } from "./submit-handler.js";

function pathEquals(a: CanonicalPath, b: CanonicalPath): boolean {
  if (a.namespace !== b.namespace) return false;
  if (a.segments.length !== b.segments.length) return false;
  return a.segments.every((seg, i) => seg === b.segments[i]);
}

function pathStartsWith(path: CanonicalPath, prefix: CanonicalPath): boolean {
  if (path.namespace !== prefix.namespace) return false;
  if (path.segments.length < prefix.segments.length) return false;
  return prefix.segments.every((seg, i) => seg === path.segments[i]);
}

/**
 * Creates a fully-configured form instance with transactional state management,
 * validation pipeline, and optional rule engine integration.
 *
 * @param options - Configuration for the form instance including initial data,
 *   validators, middleware, transforms, and arbiter rules.
 * @returns A {@link FormApi} instance with methods for state access, field manipulation,
 *   validation, and submission.
 *
 * @example
 * ```typescript
 * import { createForm } from "@formbar/core";
 *
 * const form = createForm({
 *   initialData: { name: "", email: "" },
 *   validators: [myValidator],
 *   onSubmit: async ({ payload }) => {
 *     await api.save(payload);
 *     return { ok: true, submitId: "1" };
 *   },
 * });
 *
 * form.setValue("name", "Alice");
 * const result = await form.submit();
 * ```
 */
export function createForm<TData, TUi>(
  options: CreateFormOptions<TData, TUi> = {} as CreateFormOptions<TData, TUi>,
): FormApi<TData, TUi> {
  let initialDataSnapshot: TData = structuredClone((options.initialData ?? {}) as TData);
  const initialUiStateSnapshot: TUi = structuredClone((options.initialUiState ?? {}) as TUi);

  // Justified: runtime data matches TData/TUi, narrowing for consumer DX
  const initialState = {
    data: (options.initialData ?? {}) as TData,
    uiState: (options.initialUiState ?? {}) as TUi,
    meta: { validation: {} },
    fieldMeta: {},
    issues: [],
  } as FormState<TData, TUi>;

  const store = new FormStore<TData, TUi>(initialState, options.stateStrategy);
  const listeners = createListenerRegistry();

  // Normalize validators: auto-wrap Standard Schema objects as ValidatorFn
  const normalizedValidators: ValidatorFn[] = (options.validators ?? []).map((v) => {
    if (typeof v === "function") return v as ValidatorFn;
    if (isStandardSchemaLike(v)) return createStandardSchemaValidator(v);
    throw new FormbarError("FORMBAR_INVALID_VALIDATOR", "Validator must be a function or a Standard Schema v1 object");
  });

  function resolveInitialValue(segments: readonly (string | number)[]): unknown {
    let current: unknown = initialDataSnapshot;
    for (const seg of segments) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string | number, unknown>)[seg];
    }
    return current;
  }

  let arbiterAdapter: ArbiterFormAdapter | undefined;
  if (options.arbiterSession) {
    arbiterAdapter = createArbiterAdapterFromSession(options.arbiterSession);
  } else if (options.arbiterRules?.length) {
    const initialDataObj = (options.initialData ?? {}) as Readonly<Record<string, unknown>>;
    arbiterAdapter = createArbiterAdapter(options.arbiterRules, initialDataObj);
  }

  const fieldCache = new Map<string, FieldApi<TData, TUi, string>>();

  function getIssues(path: CanonicalPath): readonly ValidationIssue[] {
    return store.getState().issues.filter((issue) => pathEquals(issue.path, path) || pathStartsWith(issue.path, path));
  }

  // Justified: pipeline treats data as opaque; variance cast is safe at this internal boundary
  const pipelineStore = store as unknown as import("./store.js").FormStore<unknown, unknown>;
  const pipelineOptions = {
    ...(options as unknown as CreateFormOptions<unknown, unknown>),
    validators: normalizedValidators,
  };

  function updateState(updater: (draft: FormState<unknown, unknown>) => FormState<unknown, unknown>): void {
    const tx = store.beginTransaction();
    // Justified: internal boundary — TData/TUi erased for async manager
    tx.mutate(updater as (draft: FormState<TData, TUi>) => FormState<TData, TUi>);
    store.commitTransaction(tx);
  }

  const asyncManager = options.asyncValidators?.length
    ? createAsyncValidationManager({
        asyncValidators: options.asyncValidators,
        getState: () => store.getState() as FormState<unknown, unknown>,
        updateState,
      })
    : undefined;

  function propagateListeners(pathKey: string, trigger: "change" | "blur"): void {
    const targets = listeners.getListeners(pathKey, trigger);
    if (targets.length === 0) return;
    const tx = store.beginTransaction();
    tx.mutate((draft) => {
      const meta = { ...draft.fieldMeta } as Record<string, FieldMetaEntry>;
      for (const t of targets) {
        const existing = meta[t.path];
        meta[t.path] = {
          touched: existing?.touched ?? false,
          isValidating: existing?.isValidating ?? false,
          dirty: existing?.dirty ?? false,
          listenerTriggered: true,
        };
      }
      return { ...draft, fieldMeta: meta };
    });
    store.commitTransaction(tx);
  }

  function dispatchSetValue(rawPath: string, value: unknown): FormDispatchResult {
    const result = executePipeline({
      action: { type: "set-value", path: rawPath, value },
      store: pipelineStore,
      options: pipelineOptions,
      isSubmit: false,
      arbiterAdapter,
    });
    if (result.ok) {
      const canonical = parsePath(rawPath);
      if (canonical.namespace === "data") {
        const pathKey = canonical.segments.join(".");
        propagateListeners(pathKey, "change");
        asyncManager?.onFieldChange(pathKey);
      }
    }
    const errorMsg = result.error ?? result.vetoReason;
    return errorMsg ? { ok: result.ok, error: errorMsg } : { ok: result.ok };
  }

  function dispatch(action: FormAction): FormDispatchResult {
    if (action.type === "set-value" && action.path !== undefined) return dispatchSetValue(action.path, action.value);
    const result = executePipeline({
      action,
      store: pipelineStore,
      options: pipelineOptions,
      isSubmit: false,
      arbiterAdapter,
    });
    const errorMsg = result.error ?? result.vetoReason;
    return errorMsg ? { ok: result.ok, error: errorMsg } : { ok: result.ok };
  }

  function validate(stage?: string): readonly ValidationIssue[] {
    const state = store.getState();
    const activeStage = stage ?? state.meta.stage;
    if (!normalizedValidators.length) return [];
    const allIssues: ValidationIssue[] = [];
    for (const v of normalizedValidators) {
      const base = { data: state.data, uiState: state.uiState };
      const input = activeStage !== undefined ? { ...base, stage: activeStage } : base;
      const result = v(input);
      if (result instanceof Promise) {
        throw new FormbarError(
          "FORMBAR_ASYNC_IN_SYNC_PIPELINE",
          "Validator returned a Promise in synchronous validate() — use async submit path",
        );
      }
      allIssues.push(...result);
    }
    return allIssues;
  }

  function markFieldTouched(pathKey: string): void {
    const tx = store.beginTransaction();
    tx.mutate((draft) => {
      const existing = (draft.fieldMeta as Record<string, FieldMetaEntry>)[pathKey];
      if (existing?.touched) return draft;
      return {
        ...draft,
        fieldMeta: {
          ...draft.fieldMeta,
          [pathKey]: {
            touched: true,
            isValidating: existing?.isValidating ?? false,
            dirty: existing?.dirty ?? false,
            listenerTriggered: existing?.listenerTriggered ?? false,
          },
        },
      };
    });
    store.commitTransaction(tx);
    propagateListeners(pathKey, "blur");
    asyncManager?.onFieldBlur(pathKey);
  }

  function updateFieldMeta(updater: (meta: Record<string, FieldMetaEntry>) => Record<string, FieldMetaEntry>): void {
    const tx = store.beginTransaction();
    tx.mutate((draft) => ({ ...draft, fieldMeta: updater(draft.fieldMeta as Record<string, FieldMetaEntry>) }));
    store.commitTransaction(tx);
  }

  function field(path: string, config?: FieldConfig): FieldApi<TData, TUi, string> {
    const cacheKey = config ? `${path}::${JSON.stringify(config)}` : path;
    const cached = fieldCache.get(cacheKey);
    if (cached) return cached;
    const canonical = parsePath(path);
    if (config?.validationTriggers) listeners.register(path, config.validationTriggers);
    const fieldApi = createFieldApi<TData, TUi>({
      path: canonical,
      rawPath: path,
      getState: () => store.getState(),
      // Justified: runtime path parsing validates path; cast bridges generic method signature
      setValue: dispatchSetValue as unknown as (path: string, value: unknown) => FormDispatchResult,
      getIssues: (p) => getIssues(p),
      getInitialValue: () => resolveInitialValue(canonical.segments),
      getFieldMeta: (pk) => (store.getState().fieldMeta as Record<string, FieldMetaEntry>)[pk],
      markTouched: markFieldTouched,
      getFormSubmitted: () => store.getState().meta.submitted ?? false,
      updateFieldMeta,
      formDefaults: options.fieldDefaults,
      config,
    });
    fieldCache.set(cacheKey, fieldApi);
    return fieldApi;
  }

  function reset(nextInitial?: { readonly data?: TData; readonly uiState?: TUi }): void {
    if (nextInitial?.data !== undefined) initialDataSnapshot = structuredClone(nextInitial.data);
    const resetData =
      nextInitial?.data !== undefined ? structuredClone(nextInitial.data) : structuredClone(initialDataSnapshot);
    const resetUi =
      nextInitial?.uiState !== undefined
        ? structuredClone(nextInitial.uiState)
        : structuredClone(initialUiStateSnapshot);
    const tx = store.beginTransaction();
    tx.mutate(
      () =>
        ({ data: resetData, uiState: resetUi, meta: { validation: {} }, fieldMeta: {}, issues: [] }) as FormState<
          TData,
          TUi
        >,
    );
    store.commitTransaction(tx);
    fieldCache.clear();
    listeners.clear();
    asyncManager?.cancelAll();
  }

  // Late-bound api reference for submit handler
  let api: FormApi<TData, TUi>;

  let submitAbortController: AbortController | undefined;

  const submit = createSubmitHandler<TData, TUi>({
    store,
    pipelineStore,
    pipelineOptions,
    options,
    arbiterAdapter,
    getApi: () => api,
    beforeOnSubmit: asyncManager
      ? async () => {
          asyncManager.cancelAll();
          submitAbortController = new AbortController();
          return asyncManager.runAllForSubmit(submitAbortController.signal);
        }
      : undefined,
  });

  api = {
    getState: () => store.getState(),
    dispatch,
    setValue: dispatchSetValue,
    validate,
    submit,
    // Justified: runtime path validation ensures P constraint; cast bridges generic method signature
    field: field as FormApi<TData, TUi>["field"],
    fieldDynamic: field as FormApi<TData, TUi>["fieldDynamic"],
    subscribe: (listener) => store.subscribe(listener),
    reset,
    canSubmit: () => !computeIsSubmitting(store.getState()) && computeIsValid(store.getState()),
    isPristine: () => computeIsPristine(store.getState(), initialDataSnapshot),
    isDirty: () => !computeIsPristine(store.getState(), initialDataSnapshot),
    isValid: () => computeIsValid(store.getState()),
    isSubmitting: () => computeIsSubmitting(store.getState()),
    isTouched: () => computeIsTouched(store.getState()),
    dispose: () => {
      submitAbortController?.abort();
      asyncManager?.cancelAll();
      arbiterAdapter?.dispose();
      disposeMiddlewares((options.middleware ?? []) as readonly Middleware[]);
      fieldCache.clear();
      store.dispose();
    },
  };

  initMiddlewares((options.middleware ?? []) as readonly Middleware[], { state: initialState });
  return api;
}
