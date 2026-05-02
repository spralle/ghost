import { createElement, forwardRef, useCallback, type AnchorHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import type { z } from "zod";
import type { ActionToken } from "@ghost-shell/contracts";

export interface ActionLinkProps<TArgs extends z.ZodType>
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "onClick"> {
  /** Action token defining the action and its args schema. */
  readonly token: ActionToken<TArgs>;
  /** Typed args matching the token's schema. */
  readonly args: z.infer<TArgs>;
  /** Callback invoked when the action is triggered. */
  readonly onAction?: (token: ActionToken<TArgs>, args: z.infer<TArgs>) => void;
  /** Class name — string or function receiving active state. */
  readonly className?: string | ((props: { readonly isActive: boolean }) => string);
  readonly children?: ReactNode;
}

/**
 * Action trigger styled as a link. Renders an `<a role="button">` that
 * executes an action via the onAction callback when clicked.
 * Respects modifier keys and keyboard activation (Enter/Space).
 */
export const ActionLink = forwardRef(function ActionLink<TArgs extends z.ZodType>(
  { token, args, onAction, className, children, ...rest }: ActionLinkProps<TArgs>,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      onAction?.(token, args);
    },
    [token, args, onAction],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLAnchorElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onAction?.(token, args);
      }
    },
    [token, args, onAction],
  );

  const resolvedClassName = typeof className === "function"
    ? className({ isActive: false })
    : className;

  return createElement("a", {
    ref,
    role: "button",
    tabIndex: 0,
    className: resolvedClassName,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    "data-ghost-action": token.id,
    ...rest,
  }, children);
}) as <TArgs extends z.ZodType>(
  props: ActionLinkProps<TArgs> & { readonly ref?: Ref<HTMLAnchorElement> },
) => React.ReactElement | null;
