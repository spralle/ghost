import type { NavigationHints, NavigationTarget, PlacementHint } from "../core/types.js";
import type { DelegatedNavigationOptions, NavigationAttachment } from "./link-types.js";
import { DEFAULT_MODIFIER_MAP, NAVIGATION_DATA_ATTRIBUTES } from "./link-types.js";
import { resolveHintsFromEvent } from "./navigation-handler.js";

/** Valid placement hint values for data-attribute validation. */
const VALID_PLACEMENT_HINTS = new Set<string>(["auto", "replace", "split", "background", "detach"]);

function isPlacementHint(value: string): value is PlacementHint {
  return VALID_PLACEMENT_HINTS.has(value);
}

/**
 * Parses a {@link NavigationTarget} from data attributes on an HTML element.
 *
 * Supports two target forms:
 * - **Route-based**: `data-route` with optional `data-params` (JSON object)
 * - **Intent-based**: `data-intent` with optional `data-facts` (JSON object)
 *
 * @example
 * ```ts
 * // <a data-ghost-navigate data-route="vessel.detail" data-params='{"vesselId":"v1"}'>
 * const target = parseNavigationTarget(element);
 * // { route: "vessel.detail", params: { vesselId: "v1" } }
 * ```
 *
 * @param element - The element to read data attributes from.
 * @returns The parsed navigation target, or null if neither route nor intent is present.
 */
export function parseNavigationTarget(element: Element): NavigationTarget | null {
  const route = element.getAttribute(NAVIGATION_DATA_ATTRIBUTES.route);
  if (route) {
    const rawParams = element.getAttribute(NAVIGATION_DATA_ATTRIBUTES.params);
    let params: Record<string, string> = {};
    if (rawParams) {
      try {
        const parsed: unknown = JSON.parse(rawParams);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          params = parsed as Record<string, string>;
        }
      } catch {
        console.warn(`[delegated-navigation] Failed to parse data-params: ${rawParams}`);
        return null;
      }
    }
    return { route, params };
  }

  const intent = element.getAttribute(NAVIGATION_DATA_ATTRIBUTES.intent);
  if (intent) {
    const rawFacts = element.getAttribute(NAVIGATION_DATA_ATTRIBUTES.facts);
    let facts: Record<string, unknown> = {};
    if (rawFacts) {
      try {
        const parsed: unknown = JSON.parse(rawFacts);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          facts = parsed as Record<string, unknown>;
        }
      } catch {
        console.warn(`[delegated-navigation] Failed to parse data-facts: ${rawFacts}`);
        return null;
      }
    }
    return { intent, facts };
  }

  return null;
}

/**
 * Parses optional {@link NavigationHints} overrides from data attributes.
 *
 * @example
 * ```ts
 * // <a data-ghost-navigate data-open="split" data-history="replace">
 * const hints = parseNavigationHints(element);
 * // { open: "split", history: "replace" }
 * ```
 *
 * @param element - The element to read hint attributes from.
 * @returns Partial navigation hints from data attributes.
 */
export function parseNavigationHints(element: Element): NavigationHints {
  const hints: { open?: PlacementHint; history?: "push" | "replace" } = {};

  const open = element.getAttribute(NAVIGATION_DATA_ATTRIBUTES.open);
  if (open && isPlacementHint(open)) {
    hints.open = open;
  }

  const history = element.getAttribute(NAVIGATION_DATA_ATTRIBUTES.history);
  if (history === "push" || history === "replace") {
    hints.history = history;
  }

  return hints;
}

/**
 * Finds the nearest ancestor (or self) with the `data-ghost-navigate` attribute.
 */
function findNavigationAncestor(target: Element, root: Element): Element | null {
  let current: Element | null = target;
  while (current && current !== root) {
    if (current.hasAttribute(NAVIGATION_DATA_ATTRIBUTES.navigate)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Creates a delegated click listener on a root element that handles all
 * `[data-ghost-navigate]` descendants automatically.
 *
 * This avoids attaching individual listeners to every navigable element,
 * which is important for dynamic content and large lists.
 *
 * @example
 * ```ts
 * const attachment = createDelegatedNavigation({
 *   root: document.getElementById("app")!,
 *   navigate: (target, hints) => router.navigate(target, hints),
 * });
 *
 * // Later, clean up:
 * attachment.dispose();
 * ```
 *
 * @param options - Delegation configuration.
 * @returns A {@link NavigationAttachment} with a `dispose()` method.
 */
export function createDelegatedNavigation(options: DelegatedNavigationOptions): NavigationAttachment {
  const { root, modifiers, navigate } = options;

  const handleClick = (event: MouseEvent): void => {
    // Ignore right-clicks
    if (event.button === 2) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const navElement = findNavigationAncestor(target, root);
    if (!navElement) return;

    // Ignore disabled elements
    if (navElement.hasAttribute("disabled") || navElement.getAttribute("aria-disabled") === "true") {
      return;
    }

    const navTarget = parseNavigationTarget(navElement);
    if (!navTarget) return;

    event.preventDefault();

    const dataHints = parseNavigationHints(navElement);
    const mergedHints = resolveHintsFromEvent(event, dataHints, modifiers ?? DEFAULT_MODIFIER_MAP);

    navigate(navTarget, mergedHints);
  };

  root.addEventListener("click", handleClick);
  root.addEventListener("auxclick", handleClick);

  return {
    dispose(): void {
      root.removeEventListener("click", handleClick);
      root.removeEventListener("auxclick", handleClick);
    },
  };
}
