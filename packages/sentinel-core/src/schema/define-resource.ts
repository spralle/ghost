import type { DataBlockConfig } from "./data-block-types.js";
import type { TypedRelation } from "./relation-types.js";

export interface ResourceSchemaConfig<T, TActions extends string> {
  readonly name: string;
  /** Phantom field — only used for type inference, not accessed at runtime */
  readonly sourceType?: T;
  readonly relations: Record<string, TypedRelation<T>>;
  readonly actions: readonly TActions[];
  readonly dataBlocks?: Record<string, DataBlockConfig<T>>;
}

export interface ResourceSchema<T, TActions extends string> {
  readonly name: string;
  readonly relations: Record<string, TypedRelation<T>>;
  readonly actions: readonly TActions[];
  readonly dataBlocks: Record<string, DataBlockConfig<T>>;
}

/** Define a resource schema with full type inference on relations and data blocks. */
export function defineResourceSchema<T, TActions extends string>(
  config: ResourceSchemaConfig<T, TActions>,
): ResourceSchema<T, TActions> {
  const { sourceType: _phantom, ...rest } = config;
  const schema: ResourceSchema<T, TActions> = {
    name: rest.name,
    relations: Object.freeze(rest.relations),
    actions: Object.freeze([...rest.actions]) as readonly TActions[],
    dataBlocks: Object.freeze(rest.dataBlocks ?? {}) as Record<string, DataBlockConfig<T>>,
  };
  return Object.freeze(schema);
}
