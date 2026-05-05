import type { ArbiterFormAdapter } from "./arbiter-integration.js";
import type { FormAction, FormApi, Middleware, SubmitResult } from "./contracts.js";
import { FormbarError } from "./errors.js";
import { runNotifyHooksAsync } from "./middleware-runner.js";
import { parsePath } from "./path-parser.js";
import { executePipeline } from "./pipeline.js";
import type { CreateFormOptions, SubmitContext, ValidationIssue } from "./state.js";
import type { FormStore } from "./store.js";
import { applySubmitOutcome } from "./submit.js";
import { DEFAULT_RUNTIME_CONSTRAINTS, withTimeout } from "./timeout.js";
import { runTransforms, type TransformDefinition } from "./transforms.js";

function normalizeFieldErrors(fieldErrors: Readonly<Record<string, string>>): ValidationIssue[] {
  return Object.entries(fieldErrors).map(([path, message]) => ({
    code: "SUBMIT_ERROR",
    message,
    severity: "error" as const,
    path: parsePath(`data.${path}`),
    source: { origin: "submit" as const, validatorId: "onSubmit" },
  }));
}

function generateSubmitId(idGenerator?: () => string): string {
  if (idGenerator) return idGenerator();
  return `submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEgressTransforms(options: CreateFormOptions<unknown, unknown>): readonly TransformDefinition[] {
  if (!options.transforms?.length) return [];
  return options.transforms.filter(
    (t): t is TransformDefinition => "transform" in t && typeof (t as TransformDefinition).transform === "function",
  );
}

export interface SubmitHandlerDeps<TData, TUi> {
  readonly store: FormStore<TData, TUi>;
  readonly pipelineStore: FormStore<unknown, unknown>;
  readonly pipelineOptions: CreateFormOptions<unknown, unknown>;
  readonly options: CreateFormOptions<TData, TUi>;
  readonly arbiterAdapter: ArbiterFormAdapter | undefined;
  readonly getApi: () => FormApi<TData, TUi>;
  /** Hook called before onSubmit execution — run async validators, return merged issues */
  readonly beforeOnSubmit?: (() => Promise<readonly ValidationIssue[]>) | undefined;
}

export function createSubmitHandler<TData, TUi>(deps: SubmitHandlerDeps<TData, TUi>) {
  const { store, pipelineStore, pipelineOptions, options, arbiterAdapter } = deps;

  function buildSubmitContext(context: Partial<SubmitContext> | undefined, submitId: string): SubmitContext {
    const clock = deps.options.clock ?? (() => new Date().toISOString());
    return {
      requestId: context?.requestId ?? submitId,
      at: context?.at ?? clock(),
      ...(context?.actorId !== undefined ? { actorId: context.actorId } : {}),
      ...(context?.metadata !== undefined ? { metadata: context.metadata } : {}),
    };
  }

  function markSubmissionRunning(submitId: string): void {
    const clock = deps.options.clock ?? (() => new Date().toISOString());
    const tx = store.beginTransaction();
    tx.mutate((draft) => ({
      ...draft,
      meta: {
        ...draft.meta,
        submitted: true,
        submission: { status: "running" as const, submitId, lastAttemptAt: clock() },
      },
    }));
    store.commitTransaction(tx);
  }

  function runSubmitPipeline(submitContext: SubmitContext) {
    return executePipeline({
      action: { type: "submit" } as FormAction,
      store: pipelineStore,
      options: pipelineOptions,
      submitContext,
      isSubmit: true,
      arbiterAdapter,
    });
  }

  function handlePipelineFailure(
    pipelineResult: {
      readonly ok: boolean;
      readonly vetoReason?: string;
      readonly error?: string;
      readonly issues?: readonly ValidationIssue[];
    },
    submitId: string,
  ): SubmitResult {
    const tx = store.beginTransaction();
    tx.mutate((draft) => ({ ...draft, meta: applySubmitOutcome(draft.meta, false, submitId) }));
    store.commitTransaction(tx);
    return {
      ok: false,
      submitId,
      message: pipelineResult.vetoReason ?? pipelineResult.error ?? "Pipeline failed",
      ...(pipelineResult.issues !== undefined ? { fieldIssues: pipelineResult.issues } : {}),
    };
  }

  function handleValidationFailure(currentIssues: readonly ValidationIssue[], submitId: string): SubmitResult {
    const tx = store.beginTransaction();
    tx.mutate((draft) => ({ ...draft, meta: applySubmitOutcome(draft.meta, false, submitId) }));
    store.commitTransaction(tx);
    return { ok: false, submitId, message: "Validation failed", fieldIssues: currentIssues };
  }

  async function executeOnSubmit(submitContext: SubmitContext, submitId: string): Promise<SubmitResult> {
    const submitAction: FormAction = { type: "submit" };
    try {
      const rawData = store.getState().data;
      const transformDefs = getEgressTransforms(pipelineOptions);
      const payload = (
        transformDefs.length > 0
          ? runTransforms(transformDefs, "egress", rawData, { state: store.getState() })
          : rawData
      ) as TData;

      const submitPromise = options.onSubmit?.({ form: deps.getApi(), submitContext, payload });
      if (!submitPromise) {
        throw new FormbarError("FORMBAR_SUBMIT_NO_HANDLER", "onSubmit handler is not defined");
      }
      const result = await withTimeout(
        submitPromise,
        options.timeouts?.submit ?? DEFAULT_RUNTIME_CONSTRAINTS.submitTimeout,
        "onSubmit callback timed out",
      );

      const normalizedFieldErrors = result.fieldErrors ? normalizeFieldErrors(result.fieldErrors) : [];
      const txResult = store.beginTransaction();
      txResult.mutate((draft) => ({
        ...draft,
        meta: applySubmitOutcome(draft.meta, result.ok, submitId),
        issues: [
          ...draft.issues,
          ...normalizedFieldErrors,
          ...(result.fieldIssues ?? []),
          ...(result.globalIssues ?? []),
        ],
      }));
      store.commitTransaction(txResult);

      await runNotifyHooksAsync(
        (options.middleware ?? []) as readonly Middleware[],
        "afterSubmit",
        { action: submitAction, state: store.getState(), result },
        options.timeouts?.middleware ?? DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout,
      );
      return result;
    } catch (err) {
      const txErr = store.beginTransaction();
      txErr.mutate((draft) => ({ ...draft, meta: applySubmitOutcome(draft.meta, false, submitId) }));
      store.commitTransaction(txErr);
      return { ok: false, submitId, message: err instanceof Error ? err.message : String(err) };
    }
  }

  return async function submit(context?: Partial<SubmitContext>): Promise<SubmitResult> {
    const state = store.getState();
    if (state.meta.submission?.status === "running") {
      return Promise.reject(
        new FormbarError("FORMBAR_SUBMIT_CONCURRENT", "Submit rejected: a submission is already in progress"),
      );
    }
    const submitId = generateSubmitId(deps.options.idGenerator);
    const submitContext = buildSubmitContext(context, submitId);
    markSubmissionRunning(submitId);
    const pipelineResult = runSubmitPipeline(submitContext);
    if (!pipelineResult.ok) return handlePipelineFailure(pipelineResult, submitId);

    // Run async validators before checking issues
    if (deps.beforeOnSubmit) {
      const asyncIssues = await deps.beforeOnSubmit();
      if (asyncIssues.length > 0) {
        const tx = store.beginTransaction();
        tx.mutate((draft) => ({ ...draft, issues: [...draft.issues, ...asyncIssues] }));
        store.commitTransaction(tx);
      }
    }

    const currentIssues = store.getState().issues;
    if (currentIssues.some((i) => i.severity === "error")) return handleValidationFailure(currentIssues, submitId);
    if (options.onSubmit) return executeOnSubmit(submitContext, submitId);
    // No onSubmit — succeed as no-op
    const txDone = store.beginTransaction();
    txDone.mutate((draft) => ({ ...draft, meta: applySubmitOutcome(draft.meta, true, submitId) }));
    store.commitTransaction(txDone);
    return { ok: true, submitId };
  };
}
