/**
 * The manifest a secondary window receives from the host,
 * telling it which plugins to load and which parts to mount.
 */

export interface PopoutManifest {
  /** Parts to mount in this window */
  parts: PopoutPartDescriptor[];
  /** Plugins to load (topologically sorted by dependencies) */
  plugins: PopoutPluginDescriptor[];
  /** Service tokens available via auto-proxy */
  availableServices: string[];
}

export interface PopoutPartDescriptor {
  partId: string;
  pluginId: string;
  /** Optional state snapshot for continuity */
  state?: unknown;
}

export interface PopoutPluginDescriptor {
  pluginId: string;
  /** Module Federation remote entry URL */
  remoteEntry: string;
}

/**
 * Contract for the popout handshake.
 * Secondary windows resolve this to get their manifest from the host.
 */
export interface PopoutManifestContract {
  getManifest(): Promise<PopoutManifest>;
}

/** Scomp contract token for the popout manifest service */
export const POPOUT_MANIFEST_CONTRACT_ID = "ghost.popout.manifest";
