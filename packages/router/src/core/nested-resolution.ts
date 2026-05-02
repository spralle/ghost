/**
 * Nested route resolution — matches a parent route and resolves its child slot.
 */

import type { ResolvedRoute } from "./define-routes.js";
import type { ChildRouteDefinition, ChildSlotRegistry } from "./child-slot.js";

export interface NestedRouteTarget {
  readonly parentRouteId: string;
  readonly childRouteId?: string;
}

export interface NestedResolutionResult {
  readonly parent: ResolvedRoute;
  readonly child: ChildRouteDefinition | null;
}

export interface ParentRouteEntry {
  readonly route: ResolvedRoute;
  readonly childSlot?: string;
}

/**
 * Resolve a nested route target against a set of parent routes and a child slot registry.
 * Returns the matched parent and (optionally) the matched child route.
 */
export function resolveNestedRoute(
  target: NestedRouteTarget,
  parentRoutes: readonly ParentRouteEntry[],
  slotRegistry: ChildSlotRegistry,
): NestedResolutionResult | undefined {
  const parentEntry = parentRoutes.find((e) => e.route.id === target.parentRouteId);
  if (!parentEntry) return undefined;

  let child: ChildRouteDefinition | null = null;
  if (target.childRouteId && parentEntry.childSlot) {
    child = slotRegistry.resolveChildRoute(parentEntry.childSlot, target.childRouteId) ?? null;
  }

  return { parent: parentEntry.route, child };
}
