import type { PluginServices, ServiceToken } from "@ghost-shell/contracts";
import { proxy } from "valtio/vanilla";
import { applyOps } from "./service-gateway-apply.js";
import type {
  ServiceCallRequest,
  ServiceCallResponse,
  StateOpBatch,
  StateSnapshotResponse,
} from "./service-gateway-contract.js";

/**
 * Transport interface that ProjectedPluginServices uses to communicate with host.
 * This abstraction allows testing without scomp and wiring to any transport.
 */
export interface ServiceGatewayTransport {
  /** Call a service method on the host. */
  callService(request: ServiceCallRequest): Promise<ServiceCallResponse>;
  /** Get the current state snapshot for a service. */
  getStateSnapshot(tokenId: string): Promise<StateSnapshotResponse>;
  /** Subscribe to state op batches from the host. Returns unsubscribe. */
  subscribeOps(callback: (batch: StateOpBatch) => void): () => void;
}

/**
 * Creates a PluginServices implementation for popout windows.
 *
 * Services are accessed via JavaScript Proxy objects that:
 * - Forward method calls to the host via ServiceGateway RPC
 * - Maintain a local valtio replica of service state (synced via op feed)
 * - Serve `.state` property reads from the local replica (synchronous)
 */
export function createProjectedPluginServices(
  transport: ServiceGatewayTransport,
): PluginServices & { dispose(): void } {
  const serviceProxies = new Map<string, unknown>();
  const stateReplicas = new Map<string, object>();
  const initialized = new Map<string, Promise<void>>();

  const unsubOps = transport.subscribeOps((batch) => {
    const replica = stateReplicas.get(batch.tokenId);
    if (replica) {
      applyOps(replica, batch.ops);
    }
  });

  function getOrCreateProxy<T>(tokenId: string): T {
    if (serviceProxies.has(tokenId)) {
      return serviceProxies.get(tokenId) as T;
    }

    let stateProxy: object | null = null;

    const initPromise = transport
      .getStateSnapshot(tokenId)
      .then((response) => {
        if (response.snapshot != null && typeof response.snapshot === "object") {
          stateProxy = proxy(structuredClone(response.snapshot) as object);
          stateReplicas.set(tokenId, stateProxy);
        }
      })
      .catch(() => {
        // Service may not have state — acceptable
      });
    initialized.set(tokenId, initPromise);

    const serviceProxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string | symbol) {
        if (typeof prop === "symbol") return undefined;
        if (prop === "state") return stateProxy;

        return (...args: unknown[]) =>
          transport.callService({ tokenId, method: prop, args }).then((response) => {
            if (!response.ok) {
              throw new Error(response.error ?? `Service call failed: ${tokenId}.${prop}`);
            }
            return response.value;
          });
      },

      has(_target, prop: string | symbol) {
        return typeof prop === "string";
      },
    });

    serviceProxies.set(tokenId, serviceProxy);
    return serviceProxy as T;
  }

  return {
    getService<T>(tokenOrId: ServiceToken<T> | string): T | null {
      const id = typeof tokenOrId === "string" ? tokenOrId : tokenOrId.id;
      return getOrCreateProxy<T>(id);
    },

    hasService(_id: string): boolean {
      return true;
    },

    dispose() {
      unsubOps();
      serviceProxies.clear();
      stateReplicas.clear();
      initialized.clear();
    },
  };
}
