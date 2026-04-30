// theme-service-registration.ts — ThemeService adapter and shell registration.
//
// Bridges the internal ThemeRegistry (shell-private) to the public
// ThemeService contract (plugin-facing). Registers the service as a
// builtin plugin capability through the PluginRegistry.

import type {
  BackgroundInfo,
  PluginContract,
  ThemeBackgroundEntry,
  ThemeInfo,
  ThemeService,
} from "@ghost-shell/contracts";
import { THEME_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import { createState } from "./reactive-state.js";
import type { ThemeRegistry } from "./theme-registry.js";

export const THEME_SERVICE_PLUGIN_ID = "ghost.shell.theme-service";

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

/**
 * Create a ThemeService adapter from a ThemeRegistry and register it
 * as a builtin plugin capability on the plugin registry.
 */
export function registerThemeServiceCapability(registry: ShellPluginRegistry, themeRegistry: ThemeRegistry): void {
  // Observable state — framework can detect changes and replicate to popouts
  const state = createState({
    activeThemeId: themeRegistry.getActiveThemeId(),
    themes: themeRegistry.getAvailableThemes(),
  });

  const themeService: ThemeService & { readonly state: typeof state } = {
    state,

    listThemes(): ThemeInfo[] {
      return state.themes;
    },

    getActiveThemeId(): string | null {
      return state.activeThemeId;
    },

    setTheme(themeId: string): boolean {
      const result = themeRegistry.setTheme(themeId);
      if (result) {
        state.activeThemeId = themeId;
        state.themes = themeRegistry.getAvailableThemes();
      }
      return result;
    },

    listBackgrounds(): ThemeBackgroundEntry[] {
      return themeRegistry.getAvailableBackgrounds();
    },

    getActiveBackground(): BackgroundInfo | null {
      return themeRegistry.getActiveBackground();
    },

    setBackground(index: number): boolean {
      return themeRegistry.setBackground(index);
    },

    setCustomBackground(url: string, mode?: "cover" | "contain" | "tile"): void {
      themeRegistry.setCustomBackground(url, mode);
    },

    clearCustomBackground(): void {
      themeRegistry.clearCustomBackground();
    },

    loadAllThemes(): Promise<void> {
      return themeRegistry.loadAllThemes().then(() => {
        state.themes = themeRegistry.getAvailableThemes();
      });
    },

    getThemePalette(themeId: string): Record<string, string> | null {
      return themeRegistry.getThemePalette(themeId);
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: THEME_SERVICE_PLUGIN_ID,
      name: "Theme Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [{ id: THEME_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [THEME_SERVICE_ID]: themeService });
}
