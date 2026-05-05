import type { FormState } from "./state.js";

/** Apply submit outcome to meta — tracks submission status only */
export function applySubmitOutcome(
  meta: FormState<unknown, unknown>["meta"],
  success: boolean,
  submitId: string,
): FormState<unknown, unknown>["meta"] {
  const now = new Date().toISOString();
  return {
    ...meta,
    validation: {
      ...meta.validation,
      lastValidatedAt: now,
    },
    submission: {
      status: success ? "succeeded" : "failed",
      submitId,
      lastAttemptAt: now,
      lastResultAt: now,
    },
  };
}
