import { createElement } from "react";
import type { LayoutRendererProps } from "../renderer-types.js";

export function FieldRenderer({ node, aria }: LayoutRendererProps) {
  return createElement("div", {
    "data-field-path": node.path,
    ...aria,
  });
}
