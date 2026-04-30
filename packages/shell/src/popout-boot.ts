/**
 * Orchestrates the full boot sequence for a secondary (popout) window.
 *
 * Sequence:
 * 1. Resolve window identity (already done by create-ghost-shell)
 * 2. Connect scomp peer (app layer responsibility, passed in)
 * 3. Resolve PopoutManifestContract → getManifest()
 * 4. Load plugins from manifest (via federation runtime)
 * 5. Activate plugins (activation resolution picks correct entry)
 * 6. Mount parts listed in manifest
 */

import type { PopoutManifest, PopoutManifestContract } from "./popout-manifest.js";
import { POPOUT_MANIFEST_CONTRACT_ID } from "./popout-manifest.js";
import type { ScompPeer } from "./scomp-runtime.js";
import type { WindowIdentity } from "./window-identity.js";

export interface PopoutBootContext {
  identity: WindowIdentity;
  scompPeer: ScompPeer;
  /** Load and activate a plugin by its descriptor */
  loadPlugin: (pluginId: string, remoteEntry: string) => Promise<void>;
  /** Mount a part after its plugin is activated */
  mountPart: (partId: string, pluginId: string, state?: unknown) => Promise<void>;
}

export interface PopoutBootResult {
  manifest: PopoutManifest;
  loadedPlugins: string[];
  mountedParts: string[];
  errors: PopoutBootError[];
}

export interface PopoutBootError {
  phase: "handshake" | "load" | "activate" | "mount";
  pluginId?: string;
  partId?: string;
  message: string;
  cause?: unknown;
}

export async function bootPopoutWindow(ctx: PopoutBootContext): Promise<PopoutBootResult> {
  const errors: PopoutBootError[] = [];
  const loadedPlugins: string[] = [];
  const mountedParts: string[] = [];

  // Handshake — get manifest from host
  const manifestService = ctx.scompPeer.resolve<PopoutManifestContract>({
    id: POPOUT_MANIFEST_CONTRACT_ID,
  });

  let manifest: PopoutManifest;
  try {
    manifest = await manifestService.getManifest();
  } catch (err) {
    errors.push({
      phase: "handshake",
      message: `Failed to get manifest from host: ${err instanceof Error ? err.message : String(err)}`,
      cause: err,
    });
    return { manifest: { parts: [], plugins: [], availableServices: [] }, loadedPlugins, mountedParts, errors };
  }

  // Load plugins sequentially (dependency-ordered)
  for (const plugin of manifest.plugins) {
    try {
      await ctx.loadPlugin(plugin.pluginId, plugin.remoteEntry);
      loadedPlugins.push(plugin.pluginId);
    } catch (err) {
      errors.push({
        phase: "load",
        pluginId: plugin.pluginId,
        message: `Failed to load plugin "${plugin.pluginId}": ${err instanceof Error ? err.message : String(err)}`,
        cause: err,
      });
    }
  }

  // Mount parts
  for (const part of manifest.parts) {
    if (!loadedPlugins.includes(part.pluginId)) {
      errors.push({
        phase: "mount",
        partId: part.partId,
        pluginId: part.pluginId,
        message: `Cannot mount part "${part.partId}" — plugin "${part.pluginId}" failed to load`,
      });
      continue;
    }

    try {
      await ctx.mountPart(part.partId, part.pluginId, part.state);
      mountedParts.push(part.partId);
    } catch (err) {
      errors.push({
        phase: "mount",
        partId: part.partId,
        pluginId: part.pluginId,
        message: `Failed to mount part "${part.partId}": ${err instanceof Error ? err.message : String(err)}`,
        cause: err,
      });
    }
  }

  return { manifest, loadedPlugins, mountedParts, errors };
}
