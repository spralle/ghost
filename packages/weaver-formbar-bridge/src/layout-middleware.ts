import type { LayoutMiddleware, LayoutNode } from "@formbar/from-schema";

interface WeaverExtensionData {
  readonly changePolicy?: unknown;
  readonly maxOverrideLayer?: unknown;
  readonly visibility?: unknown;
  readonly reloadBehavior?: unknown;
  readonly sensitive?: unknown;
}

/**
 * Layout middleware that wraps field nodes having weaver governance metadata
 * in a `governance-field` wrapper node, passing governance props through.
 */
export function createGovernanceMiddleware(): LayoutMiddleware {
  return (node, context) => {
    if (node.type !== "field") {
      return node;
    }

    const weaver = context.fieldInfo?.metadata?.extensions?.["weaver"] as WeaverExtensionData | undefined;

    if (weaver === undefined) {
      return node;
    }

    const wrapper: LayoutNode = {
      type: "governance-field",
      id: `governance-${node.id}`,
      children: [node],
      props: {
        changePolicy: weaver.changePolicy,
        maxOverrideLayer: weaver.maxOverrideLayer,
        visibility: weaver.visibility,
        reloadBehavior: weaver.reloadBehavior,
        sensitive: weaver.sensitive,
      },
    };

    return wrapper;
  };
}
