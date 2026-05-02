/** A node in the relationship graph — any entity (user, org, order, party role) */
export interface RelationNode {
  readonly type: string;
  readonly id: string;
}

/** Create a frozen RelationNode */
export function createNode(type: string, id: string): RelationNode {
  return Object.freeze({ type, id });
}

/** Stable string key for a node, used in maps and visited sets */
export function nodeKey(node: RelationNode): string {
  return `${node.type}:${node.id}`;
}
