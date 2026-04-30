/**
 * Host-side handler for the PopoutManifestContract.
 * When a popout calls getManifest(), the host identifies it by peer ID
 * and returns the corresponding manifest.
 */

import type { PopoutManifest, PopoutManifestContract } from "./popout-manifest.js";
import type { PopoutManifestRegistry } from "./popout-manifest-registry.js";

export interface PopoutManifestHostOptions {
  registry: PopoutManifestRegistry;
  /** Resolve the requesting peer's window ID (from scomp peer context) */
  getRequestingPeerId: () => string;
}

/**
 * Creates the host-side implementation of PopoutManifestContract.
 * The host serves manifests keyed by the requesting peer's window ID.
 */
export function createPopoutManifestHost(options: PopoutManifestHostOptions): PopoutManifestContract {
  const { registry, getRequestingPeerId } = options;

  return {
    async getManifest(): Promise<PopoutManifest> {
      const peerId = getRequestingPeerId();
      const manifest = registry.claim(peerId);

      if (!manifest) {
        throw new Error(
          `No manifest registered for window "${peerId}". ` +
            `The host must call registry.set(windowId, manifest) before opening the popout.`,
        );
      }

      return manifest;
    },
  };
}
