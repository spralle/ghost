import { useMemo } from "react";
import { expand } from "@ghost/sentinel";
import type { CheckContext, DerivationNode } from "@ghost/sentinel";
import { useSentinel } from "./sentinel-context";

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
