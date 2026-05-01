import { createElement, forwardRef, useCallback, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import type { NavigationHints, NavigationTarget } from "@ghost-shell/router";

export interface GhostLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className"> {
  /** The navigation target (route or intent). */
  readonly target: NavigationTarget;
  /** Optional navigation hints (placement, history). */
  readonly hints?: NavigationHints;
  /** Class name — string or function receiving active state. */
  readonly className?: string | ((props: { readonly isActive: boolean }) => string);
  /** Children to render inside the link. */
  readonly children?: ReactNode;
}

/**
 * Base navigation link component. Renders a real `<a>` element with
 * data-ghost-navigate attributes for the delegated navigation system.
 * Intercepts clicks while respecting modifier keys for native browser behavior.
 */
export const GhostLink = forwardRef<HTMLAnchorElement, GhostLinkProps>(
  function GhostLink({ target, hints, className, children, onClick, ...rest }, ref) {
    const handleClick = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        // Let browser handle modifier-key clicks natively (new tab, new window, etc.)
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // Let browser handle non-left clicks
        if (event.button !== 0) return;

        event.preventDefault();
        // The delegated navigation handler on the shell root element
        // intercepts clicks on [data-ghost-navigate] elements automatically.
        // preventDefault stops the browser default; the delegated handler
        // reads data attributes from the event target's closest match.
      },
      [onClick],
    );

    const dataAttrs = buildDataAttributes(target, hints);

    const resolvedClassName = typeof className === "function"
      ? className({ isActive: false })
      : className;

    return createElement("a", {
      ref,
      role: "link",
      tabIndex: 0,
      className: resolvedClassName,
      onClick: handleClick,
      ...dataAttrs,
      ...rest,
    }, children);
  },
);

function buildDataAttributes(
  target: NavigationTarget,
  hints?: NavigationHints,
): Record<string, string> {
  const attrs: Record<string, string> = { "data-ghost-navigate": "" };

  if ("route" in target) {
    attrs["data-route"] = target.route;
    if (Object.keys(target.params).length > 0) {
      attrs["data-params"] = JSON.stringify(target.params);
    }
  } else {
    attrs["data-intent"] = target.intent;
    if (Object.keys(target.facts).length > 0) {
      attrs["data-facts"] = JSON.stringify(target.facts);
    }
  }

  if (hints?.open) attrs["data-open"] = hints.open;
  if (hints?.history) attrs["data-history"] = hints.history;

  return attrs;
}
