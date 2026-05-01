/**
 * Wires the popout manifest contract into the scomp system.
 * Called during shell startup when a scomp peer is available.
 */

import type { ScompDisposable, ScompPeer } from "./scomp-runtime.js";
import type { PopoutManifestRegistry } from "./popout-manifest-registry.js";
import { createPopoutManifestRegistry } from "./popout-manifest-registry.js";
import { createPopoutManifestHost } from "./popout-manifest-host.js";
import { POPOUT_MANIFEST_TOKEN } from "./popout-manifest.js";

export interface PopoutManifestWiringResult {
  registry: PopoutManifestRegistry;
  dispose: () => void;
}

/**
 * Registers the PopoutManifestContract host implementation with scomp.
 * Returns the registry (for the host to set manifests) and a dispose handle.
 */
export function wirePopoutManifestContract(
  scomp: ScompPeer,
  getRequestingPeerId: () => string,
): PopoutManifestWiringResult {
  const registry = createPopoutManifestRegistry();
  const host = createPopoutManifestHost({ registry, getRequestingPeerId });

  const registration: ScompDisposable = scomp.register({
    contract: POPOUT_MANIFEST_TOKEN,
    implementation: host,
  });

  return {
    registry,
    dispose: () => registration.dispose(),
  };
}
