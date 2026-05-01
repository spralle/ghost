import { describe, expect, test } from "bun:test";

import { createNavigationGuardRegistry } from "../core/navigation-guard.js";
import type {
  NavigationGuard,
  NavigationGuardContext,
  NavigationGuardResult,
} from "../core/navigation-guard.js";
import { createPermissionGuard } from "../core/permission-guard.js";
import type { NavigationTarget } from "../core/types.js";

const ctx: NavigationGuardContext = { source: "user", currentRoute: null };
const routeTarget: NavigationTarget = { route: "dashboard", params: {} };

describe("createNavigationGuardRegistry", () => {
  test("empty registry allows all navigation", async () => {
    const registry = createNavigationGuardRegistry();
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    expect(result.allow).toBe(true);
  });

  test("single guard allows navigation", async () => {
    const registry = createNavigationGuardRegistry();
    registry.addGuard({
      id: "allow-all",
      canNavigate: () => ({ allow: true }),
    });
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    expect(result.allow).toBe(true);
  });

  test("single guard rejects with reason", async () => {
    const registry = createNavigationGuardRegistry();
    registry.addGuard({
      id: "deny",
      canNavigate: () => ({ allow: false, reason: "denied" }),
    });
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("denied");
  });

  test("multiple guards — first rejection wins", async () => {
    const registry = createNavigationGuardRegistry();
    registry.addGuard({
      id: "first",
      canNavigate: () => ({ allow: false, reason: "first" }),
    });
    registry.addGuard({
      id: "second",
      canNavigate: () => ({ allow: false, reason: "second" }),
    });
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    if (!result.allow) expect(result.reason).toBe("first");
  });

  test("guard with redirect target", async () => {
    const redirect: NavigationTarget = { route: "login", params: {} };
    const registry = createNavigationGuardRegistry();
    registry.addGuard({
      id: "redirect",
      canNavigate: () => ({ allow: false, reason: "unauthenticated", redirect }),
    });
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    if (!result.allow) expect(result.redirect).toEqual(redirect);
  });

  test("async guards resolve correctly", async () => {
    const registry = createNavigationGuardRegistry();
    registry.addGuard({
      id: "async-allow",
      canNavigate: () => Promise.resolve({ allow: true }),
    });
    registry.addGuard({
      id: "async-deny",
      canNavigate: () => Promise.resolve({ allow: false as const, reason: "async" }),
    });
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    if (!result.allow) expect(result.reason).toBe("async");
  });

  test("dispose removes guard", async () => {
    const registry = createNavigationGuardRegistry();
    const dispose = registry.addGuard({
      id: "temp",
      canNavigate: () => ({ allow: false, reason: "blocked" }),
    });
    dispose();
    const result = await registry.runGuards(routeTarget, undefined, ctx);
    expect(result.allow).toBe(true);
  });
});

describe("createPermissionGuard", () => {
  const permissions = new Map([["admin.panel", "admin:access"]]);

  test("blocks missing permission", async () => {
    const guard = createPermissionGuard(permissions, () => false);
    const target: NavigationTarget = { route: "admin.panel", params: {} };
    const result = await guard.canNavigate(target, undefined, ctx);
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("Missing permission: admin:access");
  });

  test("allows present permission", async () => {
    const guard = createPermissionGuard(permissions, () => true);
    const target: NavigationTarget = { route: "admin.panel", params: {} };
    const result = await guard.canNavigate(target, undefined, ctx);
    expect(result.allow).toBe(true);
  });

  test("ignores intent targets", async () => {
    const guard = createPermissionGuard(permissions, () => false);
    const target: NavigationTarget = { intent: "open.thing", facts: {} };
    const result = await guard.canNavigate(target, undefined, ctx);
    expect(result.allow).toBe(true);
  });

  test("allows routes without permission requirement", async () => {
    const guard = createPermissionGuard(permissions, () => false);
    const target: NavigationTarget = { route: "public.page", params: {} };
    const result = await guard.canNavigate(target, undefined, ctx);
    expect(result.allow).toBe(true);
  });
});
