import type { SchemaFieldInfo } from "@ghost-shell/schema-core";
import type { LayoutNode } from "./layout/layout-types.js";

export interface LayoutMiddlewareContext {
  readonly fieldInfo?: SchemaFieldInfo;
  readonly parent?: LayoutNode;
  readonly depth: number;
}

export type LayoutMiddleware = (node: LayoutNode, context: LayoutMiddlewareContext) => LayoutNode;

/**
 * Apply a pipeline of layout middlewares to a tree.
 * Multi-pass: each middleware walks the entire tree produced by the previous one.
 * Depth-first recursive: children are processed before their parent.
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
