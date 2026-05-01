import type { NavigationGuard, NavigationGuardContext, NavigationGuardResult } from "./navigation-guard.js";
import type { NavigationHints, NavigationTarget } from "./types.js";

/** Permission checker function — provided by the auth system. */
export type PermissionChecker = (permission: string) => boolean;

/** Route permission map — maps route IDs to required permissions. */
export type RoutePermissionMap = ReadonlyMap<string, string>;

/** Create a guard that checks static permission strings on route definitions. */
export function createPermissionGuard(
  permissions: RoutePermissionMap,
  hasPermission: PermissionChecker,
): NavigationGuard {
  return {
    id: "shell.permission-guard",
    canNavigate(
      target: NavigationTarget,
      _hints: NavigationHints | undefined,
      _ctx: NavigationGuardContext,
    ): NavigationGuardResult {
      if (!("route" in target)) return { allow: true };
      const requiredPermission = permissions.get(target.route);
      if (!requiredPermission) return { allow: true };
      if (hasPermission(requiredPermission)) return { allow: true };
      return { allow: false, reason: `Missing permission: ${requiredPermission}` };
    },
  };
}
