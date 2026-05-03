import { useMemo } from "react";
import { filterQuery } from "@ghost/sentinel";
import type { ResourceSchema } from "@ghost/sentinel";
import { useSentinel } from "./sentinel-context";

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
