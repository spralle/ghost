import { useMemo } from "react";
import { expand } from "@sentinel-guard/core";
import type { CheckContext, DerivationNode } from "@sentinel-guard/core";
import { useSentinel } from "./sentinel-context.js";

export function useExpand(
  action: string,
  resource?: Record<string, unknown>,
): DerivationNode {
  const { snapshot, principal } = useSentinel();
  const res = resource ?? {};

  return useMemo(() => {
    const context: CheckContext = {
      policy: snapshot.compiledPolicy,
      graphSubset: snapshot.graphCone,
      resource: res,
    };
    return expand(principal, action, context);
  }, [principal, action, snapshot.compiledPolicy, snapshot.graphCone, res]);
}
