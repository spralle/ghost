import { createElement, forwardRef, type ReactNode, type Ref } from "react";
import type { z } from "zod";
import type { IntentToken } from "@ghost-shell/contracts";
import { GhostLink, type GhostLinkProps } from "./GhostLink.js";

export interface IntentLinkProps<TFacts extends z.ZodType>
  extends Omit<GhostLinkProps, "target"> {
  /** Intent token defining the navigation intent and facts schema. */
  readonly token: IntentToken<TFacts>;
  /** Typed facts matching the token's schema. */
  readonly facts: z.infer<TFacts>;
  readonly children?: ReactNode;
}

/**
 * Type-safe intent navigation link. Renders a GhostLink targeting
 * the given intent with typed facts derived from the token's schema.
 */
export const IntentLink = forwardRef(function IntentLink<TFacts extends z.ZodType>(
  { token, facts, ...rest }: IntentLinkProps<TFacts>,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  return createElement(GhostLink, {
    ref,
    target: { intent: token.id, facts: facts as Record<string, unknown> },
    ...rest,
  });
}) as <TFacts extends z.ZodType>(
  props: IntentLinkProps<TFacts> & { readonly ref?: Ref<HTMLAnchorElement> },
) => React.ReactElement | null;
