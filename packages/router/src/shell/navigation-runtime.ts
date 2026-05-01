import type { NavigationHints, NavigationResult, NavigationTarget } from "../core/types.js";
import type { NavigationDelegate } from "./navigation-runtime-types.js";

/**
 * Creates a navigation runtime that dispatches navigation requests through
 * a {@link NavigationDelegate}. The runtime handles both direct route targets
 * and intent-based targets that require resolution.
 *
 * The runtime does NOT own the intent system — it delegates resolution to the
 * shell through the {@link NavigationDelegate} interface, keeping the router
 * decoupled from shell internals.
 *
 * @example
 * ```ts
 * const runtime = createNavigationRuntime({
 *   resolveIntent: async (intent, facts) => intentRegistry.resolve(intent, facts),
 *   openTab: async (defId, args, hints) => dockTree.openTab(defId, args, hints),
 *   updateTabArgs: (tabId, args) => dockTree.updateArgs(tabId, args),
 *   getActiveTabId: () => dockTree.activeTabId,
 * });
 *
 * // Direct route navigation
 * const result = await runtime.navigate(
 *   { route: "vessel.detail", params: { vesselId: "v123" } },
 *   { open: "auto" },
 * );
 *
 * // Intent-based navigation
 * const result = await runtime.navigate(
 *   { intent: "domain.entity.open", facts: { entityId: "v123" } },
 *   { open: "auto" },
 * );
 * ```
 *
 * @param delegate - Shell-provided delegate for intent resolution and tab management.
 * @returns An object with a `navigate` method.
 */
export function createNavigationRuntime(delegate: NavigationDelegate): {
  navigate(target: NavigationTarget, hints: NavigationHints): Promise<NavigationResult>;
} {
  return {
    async navigate(target: NavigationTarget, hints: NavigationHints): Promise<NavigationResult> {
      if ("intent" in target) {
        return navigateByIntent(delegate, target.intent, target.facts, hints);
      }
      return navigateByRoute(delegate, target.route, target.params, hints);
    },
  };
}

/**
 * Handles intent-based navigation by resolving the intent through the delegate
 * and then opening the resolved target.
 */
async function navigateByIntent(
  delegate: NavigationDelegate,
  intent: string,
  facts: Readonly<Record<string, unknown>>,
  hints: NavigationHints,
): Promise<NavigationResult> {
  const resolution = await delegate.resolveIntent(intent, facts);

  if (!resolution.resolved) {
    return { outcome: "no-match", reason: resolution.reason };
  }

  return openOrReplace(delegate, resolution.definitionId, factsToArgs(facts), hints);
}

/**
 * Handles direct route navigation by opening a tab with the route's definition ID.
 */
async function navigateByRoute(
  delegate: NavigationDelegate,
  route: string,
  params: Readonly<Record<string, string>>,
  hints: NavigationHints,
): Promise<NavigationResult> {
  return openOrReplace(delegate, route, { ...params }, hints);
}

/**
 * Opens a new tab or replaces the current one based on placement hints.
 */
async function openOrReplace(
  delegate: NavigationDelegate,
  definitionId: string,
  args: Record<string, string>,
  hints: NavigationHints,
): Promise<NavigationResult> {
  if (hints.open === "replace") {
    const activeTabId = delegate.getActiveTabId();
    if (activeTabId) {
      delegate.updateTabArgs(activeTabId, args);
      return { outcome: "replaced", tabId: activeTabId };
    }
  }

  const tabId = await delegate.openTab(definitionId, args, hints);
  return { outcome: "navigated", tabId };
}

/**
 * Converts intent facts (unknown values) to string args for tab opening.
 */
function factsToArgs(facts: Readonly<Record<string, unknown>>): Record<string, string> {
  const args: Record<string, string> = {};
  for (const [key, value] of Object.entries(facts)) {
    args[key] = String(value);
  }
  return args;
}
