import type { ResourceSchema } from "@ghost/sentinel";
import { filterQuery } from "@ghost/sentinel";
import { useMemo } from "react";
import { useSentinel } from "./sentinel-context.js";

export function useFilterQuery(schema: ResourceSchema<unknown, string>, relation: string): Record<string, unknown> {
  const { principal } = useSentinel();

  return useMemo(() => filterQuery(schema, relation, principal.partyIds), [schema, relation, principal.partyIds]);
}
