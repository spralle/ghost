// theme-activation.ts — Demand-driven theme plugin activation.
//
// At startup, only the active theme's plugin is loaded. Other theme plugins
// are activated on demand when the user opens the Appearance tab or switches
// themes. This avoids eagerly loading all theme plugins at bootstrap.

import type { TenantPluginDescriptor } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

/** Check whether a plugin descriptor declares theme contributions. */
function hasThemeContributions(descriptor: TenantPluginDescriptor): boolean {
  return Array.isArray(descriptor.contributes?.themes) && descriptor.contributes.themes.length > 0;
}

/** Default theme plugin ID — the fallback when no preference exists. */
export const DEFAULT_THEME_PLUGIN_ID = "ghost.theme.default";

/**
 * Activate only the plugin that provides the user's preferred theme.
 * Falls back to `fallbackPluginId` if no preference plugin is known.
 *
 * This is called during bootstrap to load a single theme plugin rather
 * than all of them.
 */
export async function activatePreferredThemePlugin(
  registry: ShellPluginRegistry,
  preferredPluginId: string | undefined,
  fallbackPluginId: string,
): Promise<boolean> {
  const targetId = preferredPluginId || fallbackPluginId;
  const snapshot = registry.getSnapshot();
  const plugin = snapshot.plugins.find((p) => p.id === targetId && p.enabled);
  if (!plugin) {
    return false;
  }
  return registry.activateByEvent(targetId, "onThemeNeeded");
}

/**
 * Activate all remaining theme plugins that haven't been loaded yet.
 *
 * Called when the user opens the Appearance tab to populate the full
 * theme gallery. After `activateByStartupEvent()` has run, non-theme
 * plugins are already active. The remaining unloaded plugins are theme
 * plugins (which no longer declare `onStartup`).
 */
export async function activateAllThemePlugins(registry: ShellPluginRegistry): Promise<void> {
  const snapshot = registry.getSnapshot();
  const activationPromises = snapshot.plugins
    .filter((p) => p.enabled && !p.contract && hasThemeContributions(p.descriptor))
    .map(async (p) => {
      try {
        await registry.activateByEvent(p.id, "onThemeNeeded");
      } catch {
        // Silently skip — plugin activation may fail.
      }
    });
  await Promise.all(activationPromises);
}
