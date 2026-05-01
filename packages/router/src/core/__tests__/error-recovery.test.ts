import { describe, expect, it } from "vitest";
import type {
  CancelledError,
  LoadError,
  NavigationError,
  NotFoundError,
  PermissionDeniedError,
  TimeoutError,
} from "../navigation-error.js";
import type { ErrorRecoveryStrategy } from "../error-recovery.js";
import { createErrorRecoveryRegistry } from "../error-recovery.js";
import type { NavigationTarget } from "../types.js";

const target: NavigationTarget = { route: "test.route", params: { id: "1" } };

describe("NavigationError types", () => {
  it("discriminates not_found", () => {
    const err: NotFoundError = { code: "not_found", message: "Not found", target };
    expect(err.code).toBe("not_found");
  });

  it("discriminates permission_denied with optional fields", () => {
    const redirect: NavigationTarget = { route: "login", params: {} };
    const err: PermissionDeniedError = {
      code: "permission_denied",
      message: "Denied",
      target,
      requiredPermission: "admin",
      redirect,
    };
    expect(err.code).toBe("permission_denied");
    expect(err.requiredPermission).toBe("admin");
    expect(err.redirect).toBe(redirect);
  });

  it("discriminates load_error with cause", () => {
    const cause = new Error("network");
    const err: LoadError = { code: "load_error", message: "Failed", target, cause };
    expect(err.cause).toBe(cause);
  });

  it("discriminates timeout with durationMs", () => {
    const err: TimeoutError = { code: "timeout", message: "Timed out", target, durationMs: 5000 };
    expect(err.durationMs).toBe(5000);
  });

  it("discriminates cancelled with reason", () => {
    const err: CancelledError = { code: "cancelled", message: "Cancelled", target, reason: "user" };
    expect(err.reason).toBe("user");
  });
});

describe("createErrorRecoveryRegistry", () => {
  it("returns null when no strategies registered", () => {
    const registry = createErrorRecoveryRegistry();
    const err: NavigationError = { code: "not_found", message: "Not found", target };
    expect(registry.tryRecover(err)).toBeNull();
  });

  it("recovers with matching strategy", () => {
    const registry = createErrorRecoveryRegistry();
    const fallback: NavigationTarget = { route: "home", params: {} };
    const strategy: ErrorRecoveryStrategy = {
      id: "fallback",
      canHandle: (e) => e.code === "not_found",
      recover: () => fallback,
    };
    registry.addStrategy(strategy);
    const err: NavigationError = { code: "not_found", message: "Not found", target };
    expect(registry.tryRecover(err)).toBe(fallback);
  });

  it("skips non-matching strategies", () => {
    const registry = createErrorRecoveryRegistry();
    const strategy: ErrorRecoveryStrategy = {
      id: "timeout-only",
      canHandle: (e) => e.code === "timeout",
      recover: () => ({ route: "retry", params: {} }),
    };
    registry.addStrategy(strategy);
    const err: NavigationError = { code: "not_found", message: "Not found", target };
    expect(registry.tryRecover(err)).toBeNull();
  });

  it("uses first matching strategy (insertion order)", () => {
    const registry = createErrorRecoveryRegistry();
    const first: NavigationTarget = { route: "first", params: {} };
    const second: NavigationTarget = { route: "second", params: {} };
    registry.addStrategy({ id: "a", canHandle: () => true, recover: () => first });
    registry.addStrategy({ id: "b", canHandle: () => true, recover: () => second });
    const err: NavigationError = { code: "not_found", message: "x", target };
    expect(registry.tryRecover(err)).toBe(first);
  });

  it("removes strategy via dispose function", () => {
    const registry = createErrorRecoveryRegistry();
    const fallback: NavigationTarget = { route: "home", params: {} };
    const dispose = registry.addStrategy({
      id: "removable",
      canHandle: () => true,
      recover: () => fallback,
    });
    dispose();
    const err: NavigationError = { code: "not_found", message: "x", target };
    expect(registry.tryRecover(err)).toBeNull();
  });

  it("skips strategy that returns null from recover", () => {
    const registry = createErrorRecoveryRegistry();
    const fallback: NavigationTarget = { route: "home", params: {} };
    registry.addStrategy({ id: "noop", canHandle: () => true, recover: () => null });
    registry.addStrategy({ id: "real", canHandle: () => true, recover: () => fallback });
    const err: NavigationError = { code: "load_error", message: "x", target };
    expect(registry.tryRecover(err)).toBe(fallback);
  });
});
