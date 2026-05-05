import type { AsyncValidatorConfig } from "./contracts.js";
import type { FieldMetaEntry, FormState, ValidationIssue } from "./state.js";

export interface AsyncValidationManager {
  onFieldChange(path: string): void;
  onFieldBlur(path: string): void;
  cancelAll(): void;
  /** Run all async validators synchronously (no debounce) for submit. Returns merged issues. */
  runAllForSubmit(signal: AbortSignal): Promise<readonly ValidationIssue[]>;
}

export interface AsyncManagerDeps {
  readonly asyncValidators: readonly AsyncValidatorConfig[];
  readonly getState: () => FormState<unknown, unknown>;
  readonly updateState: (updater: (draft: FormState<unknown, unknown>) => FormState<unknown, unknown>) => void;
}

const DEFAULT_DEBOUNCE_MS = 300;

function getLabel(v: AsyncValidatorConfig, index: number): string {
  if (v.label) return v.label;
  if (v.fields?.length) return `async:${[...v.fields].sort().join(",")}`;
  return `async:form-level:${index}`;
}

interface InFlightEntry {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Increment isValidating ref-count for a field path */
function incrementValidating(counts: Map<string, number>, fieldPath: string, deps: AsyncManagerDeps): void {
  const prev = counts.get(fieldPath) ?? 0;
  counts.set(fieldPath, prev + 1);
  if (prev === 0) setFieldValidating(deps, fieldPath, true);
}

/** Decrement isValidating ref-count for a field path */
function decrementValidating(counts: Map<string, number>, fieldPath: string, deps: AsyncManagerDeps): void {
  const prev = counts.get(fieldPath) ?? 0;
  const next = Math.max(0, prev - 1);
  counts.set(fieldPath, next);
  if (next === 0) setFieldValidating(deps, fieldPath, false);
}

function setFieldValidating(deps: AsyncManagerDeps, fieldPath: string, validating: boolean): void {
  deps.updateState((draft) => {
    const existing = (draft.fieldMeta as Record<string, FieldMetaEntry>)[fieldPath];
    return {
      ...draft,
      fieldMeta: {
        ...draft.fieldMeta,
        [fieldPath]: {
          touched: existing?.touched ?? false,
          isValidating: validating,
          dirty: existing?.dirty ?? false,
          listenerTriggered: existing?.listenerTriggered ?? false,
        },
      },
    };
  });
}

function mergeAsyncIssues(
  deps: AsyncManagerDeps,
  validatorId: string,
  fieldPaths: readonly string[],
  newIssues: readonly ValidationIssue[],
): void {
  deps.updateState((draft) => {
    // Remove previous issues from this async validator for these field paths
    const filtered = draft.issues.filter((issue) => {
      if (issue.source.origin !== "async-validator") return true;
      if (issue.source.validatorId !== validatorId) return true;
      if (fieldPaths.length === 0) return false; // form-level: remove all from this validator
      return !fieldPaths.some((fp) => issue.path.segments.join(".") === fp);
    });
    return { ...draft, issues: [...filtered, ...newIssues] };
  });
}

function getMatchingValidators(
  validators: readonly AsyncValidatorConfig[],
  path: string,
  trigger: "onChange" | "onBlur",
): readonly AsyncValidatorConfig[] {
  return validators.filter((v) => {
    const vTrigger = v.trigger ?? "onChange";
    if (vTrigger !== trigger) return false;
    if (!v.fields?.length) return true; // form-level
    return v.fields.includes(path);
  });
}

function getFieldPaths(validator: AsyncValidatorConfig, triggerPath: string): readonly string[] {
  return validator.fields?.length ? validator.fields : [triggerPath];
}

export function createAsyncValidationManager(deps: AsyncManagerDeps): AsyncValidationManager {
  const inFlight = new Map<string, InFlightEntry>();
  const validatingCount = new Map<string, number>();
  const generations = new Map<string, number>();

  function cancelEntry(key: string): void {
    const entry = inFlight.get(key);
    if (!entry) return;
    if (entry.timer !== null) clearTimeout(entry.timer);
    entry.controller.abort();
    inFlight.delete(key);
  }

  function cancelAndDecrementForValidator(validator: AsyncValidatorConfig, index: number, triggerPath: string): void {
    const key = `${getLabel(validator, index)}:${triggerPath}`;
    if (inFlight.has(key)) {
      // Bump generation so stale finally blocks skip their decrement
      const nextGen = (generations.get(key) ?? 0) + 1;
      generations.set(key, nextGen);
      cancelEntry(key);
      for (const fp of getFieldPaths(validator, triggerPath)) {
        decrementValidating(validatingCount, fp, deps);
      }
    }
  }

  function scheduleValidation(validator: AsyncValidatorConfig, index: number, triggerPath: string): void {
    cancelAndDecrementForValidator(validator, index, triggerPath);

    const fieldPaths = getFieldPaths(validator, triggerPath);
    for (const fp of fieldPaths) incrementValidating(validatingCount, fp, deps);

    const controller = new AbortController();
    const key = `${getLabel(validator, index)}:${triggerPath}`;
    const debounceMs = validator.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const gen = (generations.get(key) ?? 0) + 1;
    generations.set(key, gen);

    const timer = setTimeout(() => {
      const entry = inFlight.get(key);
      if (entry) entry.timer = null;
      runValidator(validator, index, triggerPath, controller, gen);
    }, debounceMs);

    inFlight.set(key, { controller, timer });
  }

  async function runValidator(
    validator: AsyncValidatorConfig,
    index: number,
    triggerPath: string,
    controller: AbortController,
    gen: number,
  ): Promise<readonly ValidationIssue[]> {
    const label = getLabel(validator, index);
    const key = `${label}:${triggerPath}`;
    const fieldPaths = getFieldPaths(validator, triggerPath);
    try {
      if (controller.signal.aborted) return [];
      const state = deps.getState();
      const issues = await validator.validate({ data: state.data, uiState: state.uiState, signal: controller.signal });
      if (controller.signal.aborted) return [];
      mergeAsyncIssues(deps, label, fieldPaths, issues);
      return issues;
    } catch {
      // Swallow errors from aborted/failed validators — isValidating cleaned up in finally
      return [];
    } finally {
      inFlight.delete(key);
      // Only decrement if this run wasn't superseded by a newer schedule
      if (generations.get(key) === gen) {
        for (const fp of fieldPaths) decrementValidating(validatingCount, fp, deps);
      }
    }
  }

  function triggerForPath(path: string, trigger: "onChange" | "onBlur"): void {
    const matching = getMatchingValidators(deps.asyncValidators, path, trigger);
    for (const v of matching) {
      const index = deps.asyncValidators.indexOf(v);
      scheduleValidation(v, index, path);
    }
  }

  function cancelAll(): void {
    for (const [_key, entry] of inFlight) {
      if (entry.timer !== null) clearTimeout(entry.timer);
      entry.controller.abort();
    }
    inFlight.clear();
    // Bump all generations so stale finally blocks skip their decrements
    for (const [key, gen] of generations) generations.set(key, gen + 1);
    // Reset all validating counts
    for (const [fp] of validatingCount) {
      if ((validatingCount.get(fp) ?? 0) > 0) setFieldValidating(deps, fp, false);
    }
    validatingCount.clear();
  }

  async function runAllForSubmit(signal: AbortSignal): Promise<readonly ValidationIssue[]> {
    cancelAll();
    const state = deps.getState();
    const allIssues: ValidationIssue[] = [];
    const promises = deps.asyncValidators.map(async (v) => {
      if (signal.aborted) return;
      const issues = await v.validate({ data: state.data, uiState: state.uiState, signal });
      if (!signal.aborted) allIssues.push(...issues);
    });
    await Promise.all(promises);
    return allIssues;
  }

  return {
    onFieldChange: (path) => triggerForPath(path, "onChange"),
    onFieldBlur: (path) => triggerForPath(path, "onBlur"),
    cancelAll,
    runAllForSubmit,
  };
}
