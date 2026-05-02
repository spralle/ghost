import { filterQuery } from "@ghost/sentinel";
import type { QueryDecoratorConfig, QueryDecoratorFactory, ViewDbQueryDecorator } from "./types.js";

/**
 * Factory that produces a viewdb queryDecorator function.
 * The decorator injects permission filters based on the principal's party IDs.
 */
export function createQueryDecoratorFactory(
  config: QueryDecoratorConfig,
): QueryDecoratorFactory {
  const { collectionSchemaMap, defaultRelation = "viewer", relationOverrides } = config;

  return (principalPartyIds: readonly string[]): ViewDbQueryDecorator => {
    return (collection: string, query: object, callback: (decoratedQuery: object) => void): void => {
      const schema = collectionSchemaMap[collection];

      if (!schema) {
        callback(query);
        return;
      }

      const relation = relationOverrides?.[collection] ?? defaultRelation;
      const permFilter = filterQuery(schema, relation, principalPartyIds);
      const merged = { $and: [query, permFilter] };
      callback(merged);
    };
  };
}
