import { createElement } from "react";
import type { LayoutRendererProps } from "../renderer-types.js";

export function GroupRenderer({ node, children }: LayoutRendererProps) {
  return createElement(
    "div",
    {
      role: node.role ?? "group",
      "aria-label": node.ariaLabel,
    },
    children,
  );
}
