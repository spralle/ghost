import type { SentinelStore } from "../storage/sentinel-store.js";
import type { RelationNode } from "./relation-node.js";
import { createNode, nodeKey } from "./relation-node.js";
import { createTuple } from "./relation-tuple.js";
import type { RelationTuple } from "./relation-tuple.js";
import { GraphSubset } from "./graph-subset.js";

export interface ConeOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_NODES = 500;

/** BFS from principal node, collecting reachable tuples into a GraphSubset */
export async function buildCone(
  store: SentinelStore,
  principalNode: RelationNode,
  options?: ConeOptions,
): Promise<GraphSubset> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = options?.maxNodes ?? DEFAULT_MAX_NODES;

  const visited = new Set<string>();
  visited.add(nodeKey(principalNode));

  const collectedTuples: RelationTuple[] = [];
  let frontier: RelationNode[] = [principalNode];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: RelationNode[] = [];

    for (const node of frontier) {
      if (visited.size >= maxNodes) break;

      const storeTuples = await store.loadTuplesFrom(node);

      for (const st of storeTuples) {
        const target = createNode(st.targetType, st.targetId);
        collectedTuples.push(createTuple(node, st.relation, target));

        const key = nodeKey(target);
        if (!visited.has(key)) {
          visited.add(key);
          if (visited.size >= maxNodes) break;
          next.push(target);
        }
      }
    }

    frontier = next;
  }

  return new GraphSubset(collectedTuples);
}
