import type { SchemaFieldInfo } from "@ghost-shell/schema-core";
import type { LayoutNode } from "./layout/layout-types.js";

export interface LayoutMiddlewareContext {
  readonly fieldInfo?: SchemaFieldInfo;
  readonly parent?: LayoutNode;
  readonly depth: number;
}

export type LayoutMiddleware = (node: LayoutNode, context: LayoutMiddlewareContext) => LayoutNode;

/**
 * Applies a pipeline of layout middleware to a compiled layout tree.
 * Each middleware can transform, reorder, wrap, or annotate layout nodes.
 *
 * @param tree - The root layout node tree (from schema compilation).
 * @param middlewares - Ordered array of middleware functions to apply.
 * @param fieldInfoMap - Map of field paths to their schema-extracted info.
 * @returns The transformed layout tree after all middleware has been applied.
 *
 * @example
 * ```typescript
 * const responsiveMiddleware = (node, ctx) => {
 *   if (ctx.depth === 0) node.props = { ...node.props, columns: 2 };
 *   return node;
 * };
 *
 * const tree = applyLayoutMiddleware(compiledTree, [responsiveMiddleware], fieldInfo);
 * ```
 */
export function applyLayoutMiddleware(
  tree: LayoutNode,
  middlewares: readonly LayoutMiddleware[],
  fieldInfoMap?: ReadonlyMap<string, SchemaFieldInfo>,
): LayoutNode {
  let current = tree;
  for (const middleware of middlewares) {
    current = walkNode(current, middleware, fieldInfoMap, undefined, 0);
  }
  return current;
}

function walkNode(
  node: LayoutNode,
  middleware: LayoutMiddleware,
  fieldInfoMap: ReadonlyMap<string, SchemaFieldInfo> | undefined,
  parent: LayoutNode | undefined,
  depth: number,
): LayoutNode {
  const processedChildren = node.children
    ? node.children.map((child) => walkNode(child, middleware, fieldInfoMap, node, depth + 1))
    : undefined;

  const nodeWithProcessedChildren: LayoutNode =
    processedChildren !== undefined ? { ...node, children: processedChildren } : node;

  const fieldInfo = fieldInfoMap?.get(node.path ?? node.id);
  const context: LayoutMiddlewareContext = {
    ...(fieldInfo !== undefined ? { fieldInfo } : {}),
    ...(parent !== undefined ? { parent } : {}),
    depth,
  };

  return middleware(nodeWithProcessedChildren, context);
}
