/**
 * Wires the service gateway host during shell boot for host windows.
 * Connects the lazy subscription infrastructure to the plugin registry
 * so popout windows can access services via scomp with deferred state replication.
 */

import { SERVICE_GATEWAY_CONTRACT } from "./service-gateway-contract.js";
import type { ServiceRegistry } from "./service-gateway-host.js";
import { createServiceGatewayHost } from "./service-gateway-host.js";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import type { ScompPeer } from "./scomp-runtime.js";

export interface GatewayHostWiringOptions {
  readonly pluginRegistry: ShellPluginRegistry;
  readonly scomp: ScompPeer;
}

export interface GatewayHostWiringResult {
  dispose(): void;
}

/**
 * Creates and registers the service gateway host with scomp.
 * Only call this for host windows (not popouts).
 */
export function wireGatewayHost(options: GatewayHostWiringOptions): GatewayHostWiringResult {
  const { pluginRegistry, scomp } = options;

  const registry: ServiceRegistry = {
    getService(tokenId: string): unknown | null {
      return pluginRegistry.getService(tokenId);
    },
    getServiceState(tokenId: string): object | null {
      return pluginRegistry.getServiceState(tokenId);
    },
    getRegisteredTokenIds(): string[] {
      return pluginRegistry.getRegisteredServiceIds();
    },
  };

  const gatewayHost = createServiceGatewayHost({
    registry,
    isLazy: (tokenId) => {
      const opts = pluginRegistry.getServiceOptions(tokenId);
      return opts?.lazy === true;
    },
  });

  gatewayHost.wireAllServices();

  const registration = scomp.register({
    contract: { id: SERVICE_GATEWAY_CONTRACT },
    implementation: gatewayHost,
  });

  return {
    dispose() {
      registration.dispose();
      gatewayHost.dispose();
    },
  };
}
