import { proxy } from "valtio/vanilla";
import type { GatewayStateOp } from "./service-gateway-contract.js";

/**
 * Creates a replica proxy from a snapshot received from the host.
 * The replica can then receive ops to stay in sync.
 */
export function createReplicaFromSnapshot<T extends object>(snapshot: T): T {
  return proxy(structuredClone(snapshot) as T);
}

/**
 * Apply a batch of state ops to a replica proxy.
 */
export function applyOps(replica: object, ops: GatewayStateOp[]): void {
  for (const op of ops) {
    applyOp(replica, op);
  }
}

function applyOp(replica: object, op: GatewayStateOp): void {
  const { op: operation, path, value } = op;
  if (path.length === 0) return;

  // Walk to the parent of the target
  let current: unknown = replica;
  for (let i = 0; i < path.length - 1; i++) {
    if (current == null || typeof current !== "object") return;
    if (current instanceof Map) {
      current = current.get(path[i]);
    } else {
      current = (current as Record<string | number, unknown>)[path[i]];
    }
  }

  if (current == null || typeof current !== "object") return;
  const key = path[path.length - 1];

  switch (operation) {
    case "set": {
      if (current instanceof Map) {
        current.set(key, value);
      } else {
        (current as Record<string | number, unknown>)[key] = value;
      }
      break;
    }
    case "delete": {
      if (current instanceof Map) {
        current.delete(key);
      } else if (current instanceof Set) {
        current.delete(value);
      } else {
        delete (current as Record<string | number, unknown>)[key];
      }
      break;
    }
  }
}
