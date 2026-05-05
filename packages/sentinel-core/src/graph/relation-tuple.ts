import type { RelationNode } from "./relation-node.js";

/** A directed edge in the relationship graph */
export interface RelationTuple {
  readonly source: RelationNode;
  readonly relation: string;
  readonly target: RelationNode;
}

/** Create a frozen RelationTuple */
export function createTuple(
  source: RelationNode,
  relation: string,
  target: RelationNode,
): RelationTuple {
  return Object.freeze({ source, relation, target });
}
