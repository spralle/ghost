import { useMemo } from "react";
import { filterQuery } from "@sentinel-guard/core";
import type { ResourceSchema } from "@sentinel-guard/core";
import { useSentinel } from "./sentinel-context.js";

export function useFilterQuery(
  schema: ResourceSchema<unknown, string>,
  relation: string,
): Record<string, unknown> {
  const { principal } = useSentinel();

  return useMemo(
    () => filterQuery(schema, relation, principal.partyIds),
    [schema, relation, principal.partyIds],
  );
}
