import type { RelationNode } from "./relation-node";
import { nodeKey } from "./relation-node";
import type { RelationTuple } from "./relation-tuple";

const DEFAULT_MAX_DEPTH = 10;

/** Bounded subset of the full relationship graph for offline evaluation */
export class GraphSubset {
  readonly tuples: readonly RelationTuple[];
  readonly nodeCount: number;

  /** Adjacency map: nodeKey -> relation -> target nodes */
  private readonly adjacency: Map<string, Map<string, RelationNode[]>>;

  constructor(tuples: readonly RelationTuple[]) {
    this.tuples = tuples;
    this.adjacency = new Map();

    const uniqueNodes = new Set<string>();

    for (const tuple of tuples) {
      const srcKey = nodeKey(tuple.source);
      const tgtKey = nodeKey(tuple.target);
      uniqueNodes.add(srcKey);
      uniqueNodes.add(tgtKey);

      let relMap = this.adjacency.get(srcKey);
      if (!relMap) {
        relMap = new Map();
        this.adjacency.set(srcKey, relMap);
      }

      let targets = relMap.get(tuple.relation);
      if (!targets) {
        targets = [];
        relMap.set(tuple.relation, targets);
      }
      targets.push(tuple.target);
    }

    this.nodeCount = uniqueNodes.size;
  }

  /** Find all nodes connected to source via the given relation */
  resolve(source: RelationNode, relation: string): readonly RelationNode[] {
    const relMap = this.adjacency.get(nodeKey(source));
    if (!relMap) return [];
    return relMap.get(relation) ?? [];
  }

  /** Walk transitive closure via BFS up to maxDepth */
  transitiveClosure(
    source: RelationNode,
    relation: string,
    maxDepth: number = DEFAULT_MAX_DEPTH,
  ): readonly RelationNode[] {
    const visited = new Set<string>();
    visited.add(nodeKey(source));

    const result: RelationNode[] = [];
    let frontier: RelationNode[] = [source];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const next: RelationNode[] = [];
      for (const node of frontier) {
        const targets = this.resolve(node, relation);
        for (const target of targets) {
          const key = nodeKey(target);
          if (!visited.has(key)) {
            visited.add(key);
            result.push(target);
            next.push(target);
          }
        }
      }
      frontier = next;
    }

    return result;
  }
}
