import type { z } from "zod";

import type { IntentToken } from "@ghost-shell/contracts";
import type { ViewToken } from "@ghost-shell/contracts";

import type { NavigationTarget } from "./types.js";

/**
 * Typed route-based NavigationTarget — preserves param types at compile time.
 */
export type TypedRouteTarget<TParams extends Record<string, string>> = Extract<
  NavigationTarget,
  { readonly route: string }
> & { readonly params: Readonly<TParams> };

/**
 * Typed intent-based NavigationTarget — preserves facts types at compile time.
 */
export type TypedIntentTarget<TFacts extends Record<string, unknown>> = Extract<
  NavigationTarget,
  { readonly intent: string }
> & { readonly facts: Readonly<TFacts> };

/**
 * Build a typed NavigationTarget from a route ID and params.
 * The returned value is assignable to NavigationTarget but preserves param types.
 */
export function routeTarget<TParams extends Record<string, string>>(
  route: string,
  params: TParams,
): TypedRouteTarget<TParams> {
  return { route, params } as TypedRouteTarget<TParams>;
}

/**
 * Build a typed NavigationTarget from an IntentToken.
 * Facts are validated against the token's schema type at compile time.
 */
export function intentTarget<TFacts extends z.ZodType>(
  token: IntentToken<TFacts>,
  facts: z.infer<TFacts>,
): NavigationTarget {
  return { intent: token.id, facts };
}

/**
 * Build a typed NavigationTarget from a ViewToken.
 * Args are validated against the token's schema type at compile time.
 */
export function viewTarget<TArgs extends z.ZodType>(
  token: ViewToken<TArgs>,
  args: z.infer<TArgs>,
): NavigationTarget {
  return { route: token.definitionId, params: args };
}
