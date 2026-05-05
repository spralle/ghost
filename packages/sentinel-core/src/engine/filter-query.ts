import type { ResourceSchema } from "../schema/define-resource.js";
import type { TypedRelation } from "../schema/relation-types.js";

/**
 * Generate a MongoDB query filter that restricts documents to those
 * where the principal has visibility via the specified relation.
 */
export function filterQuery(
  schema: ResourceSchema<unknown, string>,
  relation: string,
  principalPartyIds: readonly string[],
): Record<string, unknown> {
  const rel = schema.relations[relation] as TypedRelation<unknown> | undefined;
  if (!rel) {
    throw new Error(`Relation "${relation}" not found in schema "${schema.name}"`);
  }

  // Simple string path relation
  if (typeof rel === "string") {
    return { [`${rel}.id`]: { $in: [...principalPartyIds] } };
  }

  // FilteredRelation: { from, $match?, $project }
  if (isFilteredRelation(rel)) {
    const elemMatch: Record<string, unknown> = {
      ...((rel as { $match?: Record<string, unknown> }).$match ?? {}),
      [`${(rel as { $project: string }).$project}.id`]: { $in: [...principalPartyIds] },
    };
    return { [(rel as { from: string }).from]: { $elemMatch: elemMatch } };
  }

  // RecursiveRelation: { $recurse, $project }
  if (isRecursiveRelation(rel)) {
    const path = (rel as { $project: string }).$project;
    const arrayField = (rel as { $recurse: string }).$recurse;
    return { [arrayField]: { $elemMatch: { [`${path}.id`]: { $in: [...principalPartyIds] } } } };
  }

  throw new Error(`Unsupported relation type for "${relation}"`);
}

function isFilteredRelation(rel: unknown): boolean {
  return typeof rel === "object" && rel !== null && "from" in rel && "$project" in rel;
}

function isRecursiveRelation(rel: unknown): boolean {
  return typeof rel === "object" && rel !== null && "$recurse" in rel && "$project" in rel;
}
