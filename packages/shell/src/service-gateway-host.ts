import type {
  ServiceCallRequest,
  ServiceCallResponse,
  StateSnapshotRequest,
  StateSnapshotResponse,
  StateOpBatch,
  GatewayStateOp,
} from "./service-gateway-contract.js";
import { subscribeState, getStateSnapshot, isManagedState } from "./reactive-state.js";

/**
 * Registry that the host-side gateway uses to resolve services.
 */
export interface ServiceRegistry {
  getService(tokenId: string): unknown | null;
  getServiceState(tokenId: string): object | null;
  getRegisteredTokenIds(): string[];
}

/**
 * Creates the host-side service gateway implementation.
 * Handles incoming RPC calls from popouts and streams state ops.
 */
export function createServiceGatewayHost(registry: ServiceRegistry) {
  const opSubscribers = new Set<(batch: StateOpBatch) => void>();
  const stateUnsubscribers = new Map<string, () => void>();

  function wireStateSubscription(tokenId: string): void {
    const state = registry.getServiceState(tokenId);
    if (!state || !isManagedState(state)) return;
    if (stateUnsubscribers.has(tokenId)) return;

    const unsub = subscribeState(state, (ops) => {
      const batch: StateOpBatch = {
        tokenId,
        ops: ops.map(([op, path, value, prevValue]): GatewayStateOp => ({
          op,
          path: path.map((p) => (typeof p === "symbol" ? p.toString() : p)) as (string | number)[],
          value,
          prevValue,
        })),
        timestamp: Date.now(),
      };
      for (const sub of opSubscribers) {
        sub(batch);
      }
    });
    stateUnsubscribers.set(tokenId, unsub);
  }

  function wireAllServices(): void {
    for (const tokenId of registry.getRegisteredTokenIds()) {
      wireStateSubscription(tokenId);
    }
  }

  async function callService(request: ServiceCallRequest): Promise<ServiceCallResponse> {
    const service = registry.getService(request.tokenId);
    if (!service) {
      return { ok: false, error: `Service not found: ${request.tokenId}` };
    }
    const method = (service as Record<string, unknown>)[request.method];
    if (typeof method !== "function") {
      return { ok: false, error: `Method not found: ${request.method} on ${request.tokenId}` };
    }
    try {
      const result = await method.apply(service, request.args);
      return { ok: true, value: result };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function getSnapshot(request: StateSnapshotRequest): Promise<StateSnapshotResponse> {
    const state = registry.getServiceState(request.tokenId);
    if (!state || !isManagedState(state)) {
      return { tokenId: request.tokenId, snapshot: null };
    }
    return { tokenId: request.tokenId, snapshot: getStateSnapshot(state) };
  }

  function subscribeOps(callback: (batch: StateOpBatch) => void): () => void {
    opSubscribers.add(callback);
    return () => { opSubscribers.delete(callback); };
  }

  function dispose(): void {
    for (const unsub of stateUnsubscribers.values()) {
      unsub();
    }
    stateUnsubscribers.clear();
    opSubscribers.clear();
  }

  return { callService, getSnapshot, subscribeOps, wireAllServices, wireStateSubscription, dispose };
}
