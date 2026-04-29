/**
 * Popout window initialization — sets up projected services and style sync.
 * Called instead of hydratePluginRegistry when runtime.isPopout is true.
 */

import type { PluginServices } from "@ghost-shell/contracts";
import { createProjectedPluginServices, type ServiceGatewayTransport } from "./projected-plugin-services.js";
import { applyDomStyleSnapshot, applyDomSyncMutations, type DomStyleSnapshot, type DomSyncMutation } from "./dom-style-sync.js";

/**
 * Transport that bridges to the host window.
 * Extends ServiceGatewayTransport with DOM sync capabilities.
 */
export interface PopoutTransport extends ServiceGatewayTransport {
  /** Get the current DOM style snapshot from host. */
  getDomStyleSnapshot(): Promise<DomStyleSnapshot>;
  /** Subscribe to DOM style mutations from host. Returns unsubscribe. */
  subscribeDomSync(callback: (mutations: DomSyncMutation[]) => void): () => void;
}

/**
 * Result of popout initialization — provides cleanup handle.
 */
export interface PopoutInitResult {
  readonly services: PluginServices;
  readonly dispose: () => void;
}

/**
 * Initialize a popout window with projected services and style sync.
 *
 * @param transport - Connection to the host window
 * @param targetDoc - The popout's document (for style sync)
 * @returns Projected services and cleanup function
 */
export async function initializePopout(
  transport: PopoutTransport,
  targetDoc: Document = document,
): Promise<PopoutInitResult> {
  const projectedServices = createProjectedPluginServices(transport);

  const snapshot = await transport.getDomStyleSnapshot();
  applyDomStyleSnapshot(snapshot, targetDoc);

  const unsubDom = transport.subscribeDomSync((mutations) => {
    applyDomSyncMutations(mutations, targetDoc);
  });

  return {
    services: projectedServices,
    dispose() {
      unsubDom();
      projectedServices.dispose();
    },
  };
}
