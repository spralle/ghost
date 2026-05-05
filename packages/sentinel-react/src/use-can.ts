import { useMemo } from "react";
import { can } from "@sentinel-guard/core";
import type { CheckContext } from "@sentinel-guard/core";
import { useSentinel } from "./sentinel-context.js";

export interface UseCanResult {
  readonly allowed: boolean;
}

export function useCan(
  action: string,
  resource?: Record<string, unknown>,
): UseCanResult {
  const { snapshot, principal } = useSentinel();
  const res = resource ?? {};

  const allowed = useMemo(() => {
    const context: CheckContext = {
      policy: snapshot.compiledPolicy,
      graphSubset: snapshot.graphCone,
      resource: res,
    };
    return can(principal, action, context);
  }, [principal, action, snapshot.compiledPolicy, snapshot.graphCone, res]);

  return { allowed };
}
