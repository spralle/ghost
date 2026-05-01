import type { NavigationHints, NavigationTarget } from "../core/types.js";
import type { NavigationAttachment } from "./link-types.js";

/** Options for the root link interceptor. */
export interface LinkInterceptorOptions {
  /** Root element to attach the listener to. */
  readonly root: Element;
  /** Navigation callback. */
  readonly navigate: (target: NavigationTarget, hints?: NavigationHints) => void;
  /** Custom protocol scheme to intercept (default: "ghost"). */
  readonly scheme?: string;
}

/** Internal ghost:// URL format: ghost://route/{routeId}?param1=val1&param2=val2 */
const GHOST_PROTOCOL_RE = /^ghost:\/\//;

/** Parse a ghost:// URL into a NavigationTarget. */
export function parseGhostUrl(url: string): NavigationTarget | null {
  if (!GHOST_PROTOCOL_RE.test(url)) return null;
  try {
    // ghost://route/vessel.detail?vesselId=v123
    // URL parses as: host="route", pathname="/vessel.detail"
    const parsed = new URL(url);
    const type = parsed.host;
    const id = parsed.pathname.slice(1); // remove leading "/"
    if (!type || !id) return null;

    if (type === "route") {
      const params: Record<string, string> = {};
      parsed.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return { route: id, params };
    }
    if (type === "intent") {
      const facts: Record<string, unknown> = {};
      parsed.searchParams.forEach((value, key) => {
        facts[key] = value;
      });
      return { intent: id, facts };
    }
    return null;
  } catch {
    return null;
  }
}

/** Find the closest <a> ancestor of an element. */
function findClosestAnchor(element: Element, root: Element): HTMLAnchorElement | null {
  let current: Element | null = element;
  while (current && current !== root) {
    if (current instanceof HTMLAnchorElement) return current;
    current = current.parentElement;
  }
  return null;
}

/** Create a root-level link interceptor. Conservative — only intercepts ghost:// hrefs. */
export function createLinkInterceptor(options: LinkInterceptorOptions): NavigationAttachment {
  const { root, navigate } = options;

  const handleClick = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    // Ignore non-left clicks
    if (event.button !== 0) return;
    // Ignore modifier keys — let browser handle (new tab, etc.)
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Already handled by another handler
    if (event.defaultPrevented) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = findClosestAnchor(target, root);
    if (!anchor) return;

    // Skip if explicitly marked as external
    if (anchor.hasAttribute("data-ghost-external")) return;
    // Skip if already using data-ghost-navigate (handled by delegated navigation)
    if (anchor.hasAttribute("data-ghost-navigate")) return;
    // Skip if disabled
    if (anchor.hasAttribute("disabled") || anchor.getAttribute("aria-disabled") === "true") return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    const navTarget = parseGhostUrl(href);
    if (!navTarget) return;

    event.preventDefault();
    navigate(navTarget);
  };

  // Use capture phase to intercept before other handlers
  root.addEventListener("click", handleClick, { capture: true });

  return {
    dispose() {
      root.removeEventListener("click", handleClick, { capture: true });
    },
  };
}
