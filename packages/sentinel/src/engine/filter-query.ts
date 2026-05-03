import type { ResourceSchema } from "../schema/define-resource";
import type { TypedRelation } from "../schema/relation-types";

/**
 * Generate a MongoDB query filter that restricts documents to those
 * where the principal has visibility via the specified relation.
 */
export function filterQuery(
  schema: ResourceSchema<unknown, string>,
  relation: string,
  principalPartyIds: readonly string[],
): Record<string, unknown> {
  const rel = schema.relations[relation] as
    | string
    | FilteredRelationShape
    | RecursiveRelationShape
    | undefined;
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
      ...(rel.$match ?? {}),
      [`${rel.$project}.id`]: { $in: [...principalPartyIds] },
    };
    return { [rel.from]: { $elemMatch: elemMatch } };
  }

  // RecursiveRelation: { $recurse, $project }
  if (isRecursiveRelation(rel)) {
    const path = rel.$project;
    const arrayField = rel.$recurse;
    return { [arrayField]: { $elemMatch: { [`${path}.id`]: { $in: [...principalPartyIds] } } } };
  }

  throw new Error(`Unsupported relation type for "${relation}"`);
}

interface FilteredRelationShape {
  readonly from: string;
  readonly $project: string;
  readonly $match?: Record<string, unknown>;
}

interface RecursiveRelationShape {
  readonly $recurse: string;
  readonly $project: string;
}

function isFilteredRelation(rel: unknown): rel is FilteredRelationShape {
  return typeof rel === "object" && rel !== null && "from" in rel && "$project" in rel;
}

function isRecursiveRelation(rel: unknown): rel is RecursiveRelationShape {
  return typeof rel === "object" && rel !== null && "$recurse" in rel && "$project" in rel;
}
