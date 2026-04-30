/**
 * Host-side registry that stores manifests for pending popout windows.
 * The host prepares a manifest before opening the window,
 * keyed by the popout's assigned windowId.
 */

import type { PopoutManifest } from "./popout-manifest.js";

export interface PopoutManifestRegistry {
  /** Store a manifest for a specific window ID (called before window.open) */
  set(windowId: string, manifest: PopoutManifest): void;
  /** Retrieve and remove manifest for a window ID (called when popout connects) */
  claim(windowId: string): PopoutManifest | null;
  /** Check if a manifest exists for a window ID */
  has(windowId: string): boolean;
  /** Remove a manifest without claiming (e.g., if popout window was closed before connecting) */
  remove(windowId: string): void;
  /** Number of pending manifests */
  readonly size: number;
}

export function createPopoutManifestRegistry(): PopoutManifestRegistry {
  const manifests = new Map<string, PopoutManifest>();

  return {
    set(windowId, manifest) {
      manifests.set(windowId, manifest);
    },
    claim(windowId) {
      const manifest = manifests.get(windowId) ?? null;
      if (manifest) manifests.delete(windowId);
      return manifest;
    },
    has(windowId) {
      return manifests.has(windowId);
    },
    remove(windowId) {
      manifests.delete(windowId);
    },
    get size() {
      return manifests.size;
    },
  };
}
