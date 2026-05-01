import type { NavigationTarget } from "./types.js";

/** Discriminant codes for navigation errors. */
export type NavigationErrorCode =
  | "not_found"
  | "permission_denied"
  | "load_error"
  | "timeout"
  | "cancelled";

/** Base shape shared by all navigation errors. */
export interface NavigationErrorBase {
  readonly code: NavigationErrorCode;
  readonly message: string;
  readonly target: NavigationTarget;
}

export interface NotFoundError extends NavigationErrorBase {
  readonly code: "not_found";
}

export interface PermissionDeniedError extends NavigationErrorBase {
  readonly code: "permission_denied";
  readonly requiredPermission?: string;
  readonly redirect?: NavigationTarget;
}

export interface LoadError extends NavigationErrorBase {
  readonly code: "load_error";
  readonly cause?: Error;
}

export interface TimeoutError extends NavigationErrorBase {
  readonly code: "timeout";
  readonly durationMs: number;
}

export interface CancelledError extends NavigationErrorBase {
  readonly code: "cancelled";
  readonly reason: string;
}

/** Discriminated union of all navigation errors. */
export type NavigationError =
  | NotFoundError
  | PermissionDeniedError
  | LoadError
  | TimeoutError
  | CancelledError;
