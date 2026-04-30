import { createLazySubscriptionManager, type LazySubscriptionManager } from "./lazy-subscription-manager.js";
import { getStateSnapshot, isManagedState, subscribeState } from "./reactive-state.js";
import type {
  GatewayStateOp,
  ServiceCallRequest,
  ServiceCallResponse,
  StateOpBatch,
  StateSnapshotRequest,
  StateSnapshotResponse,
} from "./service-gateway-contract.js";

/** Check if return value contains non-serializable patterns */
function validateRpcResponse(tokenId: string, method: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value === "function") {
    throw new Error(
      `Service "${tokenId}.${method}()" returned a function. ` +
        `Auto-proxy cannot serialize functions. ` +
        `Define an "activations" entry in the plugin manifest for secondary window behavior.`,
    );
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
      const keys = Object.getOwnPropertyNames(value);
      const hasMethods = keys.some((k) => typeof (value as Record<string, unknown>)[k] === "function");
      if (hasMethods) {
        throw new Error(
          `Service "${tokenId}.${method}()" returned an object with methods. ` +
            `Auto-proxy cannot serialize complex objects. ` +
            `Define an "activations" entry in the plugin manifest for secondary window behavior.`,
        );
      }
    }
  }
}

/**
 * Registry that the host-side gateway uses to resolve services.
 */
export interface ServiceRegistry {
  getService(tokenId: string): unknown | null;
  getServiceState(tokenId: string): object | null;
  getRegisteredTokenIds(): string[];
}

export interface ServiceGatewayHostOptions {
  registry: ServiceRegistry;
  /** Returns true if the service should defer state replication until first access */
  isLazy?: (tokenId: string) => boolean;
}

/**
 * Creates the host-side service gateway implementation.
 * Handles incoming RPC calls from popouts and streams state ops.
 */
export function createServiceGatewayHost(registryOrOptions: ServiceRegistry | ServiceGatewayHostOptions) {
  const registry: ServiceRegistry = "registry" in registryOrOptions ? registryOrOptions.registry : registryOrOptions;
  const isLazy = "isLazy" in registryOrOptions ? registryOrOptions.isLazy : undefined;

  const opSubscribers = new Set<(batch: StateOpBatch) => void>();
  const stateUnsubscribers = new Map<string, () => void>();

  const lazyManager: LazySubscriptionManager = createLazySubscriptionManager({
    onActivate: (tokenId) => {
      wireStateSubscription(tokenId);
      return () => {
        const unsub = stateUnsubscribers.get(tokenId);
        if (unsub) {
          unsub();
          stateUnsubscribers.delete(tokenId);
        }
      };
    },
  });

  function wireStateSubscription(tokenId: string): void {
    const state = registry.getServiceState(tokenId);
    if (!state || !isManagedState(state)) return;
    if (stateUnsubscribers.has(tokenId)) return;

    const unsub = subscribeState(state, (ops) => {
      const batch: StateOpBatch = {
        tokenId,
        ops: ops.map(
          ([op, path, value, prevValue]): GatewayStateOp => ({
            op,
            path: path.map((p) => (typeof p === "symbol" ? p.toString() : p)) as (string | number)[],
            value,
            prevValue,
          }),
        ),
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
      if (isLazy?.(tokenId)) continue;
      wireStateSubscription(tokenId);
    }
  }

  async function callService(request: ServiceCallRequest): Promise<ServiceCallResponse> {
    if (isLazy?.(request.tokenId) && !lazyManager.isActive(request.tokenId)) {
      lazyManager.acquire(request.tokenId);
    }

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
      validateRpcResponse(request.tokenId, request.method, result);
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
    return () => {
      opSubscribers.delete(callback);
    };
  }

  function dispose(): void {
    lazyManager.disposeAll();
    for (const unsub of stateUnsubscribers.values()) {
      unsub();
    }
    stateUnsubscribers.clear();
    opSubscribers.clear();
  }

  return { callService, getSnapshot, subscribeOps, wireAllServices, wireStateSubscription, lazyManager, dispose };
}
