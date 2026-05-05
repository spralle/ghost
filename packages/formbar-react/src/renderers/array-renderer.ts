import { createElement } from "react";
import type { LayoutRendererProps } from "../renderer-types.js";

export function ArrayRenderer({ node, children }: LayoutRendererProps) {
  const title = node.props?.["title"] as string | undefined;
  const label = node.ariaLabel ?? title;

  return createElement(
    "div",
    {
      role: "list",
      "aria-label": label,
    },
    children,
  );
}
