import { createElement, forwardRef, type ReactNode, type Ref } from "react";
import type { z } from "zod";
import type { ViewToken } from "@ghost-shell/contracts";
import { GhostLink, type GhostLinkProps } from "./GhostLink.js";

export interface ViewLinkProps<TArgs extends z.ZodType>
  extends Omit<GhostLinkProps, "target"> {
  /** View token defining the view and its args schema. */
  readonly token: ViewToken<TArgs>;
  /** Typed args matching the token's schema. */
  readonly args: z.infer<TArgs>;
  readonly children?: ReactNode;
}

/**
 * Type-safe view navigation link. Renders a GhostLink targeting
 * the given view's route with typed args derived from the token's schema.
 */
export const ViewLink = forwardRef(function ViewLink<TArgs extends z.ZodType>(
  { token, args, ...rest }: ViewLinkProps<TArgs>,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  return createElement(GhostLink, {
    ref,
    target: { route: token.definitionId, params: args as Record<string, string> },
    ...rest,
  });
}) as <TArgs extends z.ZodType>(
  props: ViewLinkProps<TArgs> & { readonly ref?: Ref<HTMLAnchorElement> },
) => React.ReactElement | null;
