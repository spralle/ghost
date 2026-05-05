import { FormbarError } from "./errors.js";

// ADR section 11.2 — Runtime constraints

export interface RuntimeConstraints {
  readonly validatorTimeout: number;
  readonly middlewareTimeout: number;
  readonly submitTimeout: number;
}

export const DEFAULT_RUNTIME_CONSTRAINTS: RuntimeConstraints = {
  validatorTimeout: 500,
  middlewareTimeout: 250,
  submitTimeout: 30_000,
};

/** Race a promise against a timeout, throwing FORMBAR_TIMEOUT on expiry. */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new FormbarError("FORMBAR_TIMEOUT", errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
