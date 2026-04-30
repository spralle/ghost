// theme-registry.ts — Shell theme registry: discovery, switching, and application.
//
// Discovers theme contributions from active plugins, applies CSS variables
// via the derivation engine, and supports runtime theme switching with
// user preference persistence.

import type { FullThemePalette, PluginContract, ThemeBackgroundEntry } from "@ghost-shell/contracts";
import { type ComposedThemeContribution, composeThemeContributions } from "@ghost-shell/plugin-system";
import type { LayerRegistry } from "@ghost-shell/layer";
import {
  clearBackgroundPreference,
  deriveFullPalette,
  GHOST_THEME_CSS_VARS,

  preloadBackgroundUrls,
  readBackgroundPreference,
  readUserThemePreference,
  writeBackgroundPreference,
  writeUserThemePreference,
} from "@ghost-shell/theme";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import { createBackgroundLayerController } from "./theme-background-layer.js";
import { activateAllThemePlugins } from "./theme-activation.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ThemeRegistryOptions {
  pluginRegistry: ShellPluginRegistry;
  tenantDefaultThemeId?: string | undefined;
  layerRegistry?: LayerRegistry | undefined;
}

export interface AvailableTheme {
  id: string;
  name: string;
  author?: string | undefined;
  mode: string;
  pluginId: string;
}

export interface ActiveBackground {
  url: string;
  mode: "cover" | "contain" | "tile";
  source: "theme" | "custom";
  index: number | null;
}

export interface ThemeRegistry {
  /** Discover themes from all active plugins. Additive — merges with previously discovered themes. */
  discoverThemes(): void;
  /** Load all remaining theme plugins and re-discover themes. For gallery population. */
  loadAllThemes(): Promise<void>;
  /** Get list of available theme IDs, names, modes, and source plugins. */
  getAvailableThemes(): AvailableTheme[];
  /** Get the currently active theme ID (null if none applied). */
  getActiveThemeId(): string | null;
  /** Switch to a different theme by ID. Applies CSS variables immediately. Returns false if theme not found. */
  setTheme(themeId: string): boolean;
  /** Apply the resolved initial theme (user pref → tenant default → first available). */
  applyInitialTheme(): void;
  /** Get the list of background entries for the active theme. */
  getAvailableBackgrounds(): ThemeBackgroundEntry[];
  /** Get info about the currently displayed background. Returns null if no background. */
  getActiveBackground(): ActiveBackground | null;
  /** Switch to a specific background from the active theme by index. Returns false if invalid. */
  setBackground(index: number): boolean;
  /** Set a custom background URL (not from the theme's array). */
  setCustomBackground(url: string, mode?: "cover" | "contain" | "tile"): void;
  /** Clear custom background, revert to theme's default (index 0) or no background. */
  clearCustomBackground(): void;
  /** Get all CSS variable values for a given theme, or null if not found. */
  getThemePalette(themeId: string): Record<string, string> | null;
  /** Remove themes from disabled plugins. Falls back if active theme was pruned. */
  pruneDisabledPluginThemes(): void;
}

// ---------------------------------------------------------------------------
// CSS variable injection
// ---------------------------------------------------------------------------

const THEME_DERIVED_STYLE_ID = "ghost-theme-derived-variables";

/**
 * Inject derived palette CSS variables onto :root via a managed style element.
 * Uses the canonical GHOST_THEME_CSS_VARS mapping from plugin-contracts.
 */
function injectDerivedPaletteVariables(palette: FullThemePalette): void {
  if (typeof document === "undefined") {
    return;
  }

  let styleEl = document.getElementById(THEME_DERIVED_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = THEME_DERIVED_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const entries = Object.entries(GHOST_THEME_CSS_VARS) as Array<[keyof FullThemePalette, string]>;
  const declarations = entries.map(([token, cssVar]) => `  ${cssVar}: ${palette[token]};`).join("\n");

  styleEl.textContent = `:root {\n${declarations}\n}`;
}

// ---------------------------------------------------------------------------
// Plugin source collection
// ---------------------------------------------------------------------------

function collectPluginThemeSources(
  registry: ShellPluginRegistry,
): Array<{ pluginId: string; contract: PluginContract }> {
  const snapshot = registry.getSnapshot();
  const sources: Array<{ pluginId: string; contract: PluginContract }> = [];

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || !plugin.contract) {
      continue;
    }
    sources.push({ pluginId: plugin.id, contract: plugin.contract });
  }

  return sources;
}

// ---------------------------------------------------------------------------
// Theme resolution
// ---------------------------------------------------------------------------

function resolveThemeId(themes: ComposedThemeContribution[], tenantDefaultThemeId: string | undefined): string | null {
  if (themes.length === 0) {
    return null;
  }

  // 1. User preference from localStorage
  const userPref = readUserThemePreference();
  if (userPref && themes.some((t) => t.id === userPref.themeId)) {
    return userPref.themeId;
  }

  // 2. Tenant default
  if (tenantDefaultThemeId && themes.some((t) => t.id === tenantDefaultThemeId)) {
    return tenantDefaultThemeId;
  }

  // 3. First available theme
  return themes[0]?.id ?? null;
}

// Re-export for backward compatibility.
export { manageBackgroundImage } from "@ghost-shell/theme";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createThemeRegistry(options: ThemeRegistryOptions): ThemeRegistry {
  const { pluginRegistry, tenantDefaultThemeId, layerRegistry } = options;
  let discoveredThemes: ComposedThemeContribution[] = [];
  let activeThemeId: string | null = null;
  let activeBackground: ActiveBackground | null = null;
  const backgroundController = createBackgroundLayerController(layerRegistry);

  function mergeThemes(
    existing: ComposedThemeContribution[],
    incoming: ComposedThemeContribution[],
  ): ComposedThemeContribution[] {
    const result = [...existing];
    for (const theme of incoming) {
      const idx = result.findIndex((t) => t.id === theme.id);
      if (idx >= 0) {
        result[idx] = theme;
      } else {
        result.push(theme);
      }
    }
    return result;
  }

  function findTheme(themeId: string): ComposedThemeContribution | undefined {
    return discoveredThemes.find((t) => t.id === themeId);
  }

  function applyBackgroundEntry(entry: ThemeBackgroundEntry, source: "theme" | "custom", index: number | null): void {
    backgroundController.apply(entry);
    activeBackground = {
      url: entry.url,
      mode: entry.mode ?? "cover",
      source,
      index,
    };
  }

  function applyThemeBackground(theme: ComposedThemeContribution, themeId: string): void {
    const pref = readBackgroundPreference(themeId);
    const backgrounds = theme.backgrounds ?? [];

    // Preload all theme backgrounds for instant switching.
    preloadBackgroundUrls(backgrounds.map((b) => b.url));

    if (pref) {
      if (pref.index !== null && pref.index >= 0 && pref.index < backgrounds.length) {
        applyBackgroundEntry(backgrounds[pref.index]!, "theme", pref.index);
        return;
      }
      if (pref.index === null && pref.custom) {
        const entry: ThemeBackgroundEntry = {
          url: pref.custom.url,
          mode: pref.custom.mode,
        };
        applyBackgroundEntry(entry, "custom", null);
        return;
      }
    }

    // Default: first background or none
    if (backgrounds.length > 0) {
      applyBackgroundEntry(backgrounds[0]!, "theme", 0);
    } else {
      backgroundController.apply(undefined);
      activeBackground = null;
    }
  }

  function applyTheme(theme: ComposedThemeContribution): void {
    const fullPalette = deriveFullPalette(theme.palette, theme.terminal);
    injectDerivedPaletteVariables(fullPalette);
    applyThemeBackground(theme, theme.id);
  }

  return {
    discoverThemes() {
      const sources = collectPluginThemeSources(pluginRegistry);
      const newThemes = composeThemeContributions(sources);
      discoveredThemes = mergeThemes(discoveredThemes, newThemes);
    },

    async loadAllThemes() {
      await activateAllThemePlugins(pluginRegistry);
      const sources = collectPluginThemeSources(pluginRegistry);
      const newThemes = composeThemeContributions(sources);
      discoveredThemes = mergeThemes(discoveredThemes, newThemes);
    },

    getAvailableThemes(): AvailableTheme[] {
      return discoveredThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        author: theme.author,
        mode: theme.mode,
        pluginId: theme.pluginId,
      }));
    },

    getActiveThemeId(): string | null {
      return activeThemeId;
    },

    setTheme(themeId: string): boolean {
      const theme = findTheme(themeId);
      if (!theme) {
        return false;
      }

      applyTheme(theme);
      activeThemeId = themeId;
      writeUserThemePreference({ themeId, pluginId: theme.pluginId });
      return true;
    },

    applyInitialTheme() {
      const resolvedId = resolveThemeId(discoveredThemes, tenantDefaultThemeId);
      if (!resolvedId) {
        return;
      }

      const theme = findTheme(resolvedId);
      if (!theme) {
        return;
      }

      applyTheme(theme);
      activeThemeId = resolvedId;
    },

    getAvailableBackgrounds(): ThemeBackgroundEntry[] {
      if (!activeThemeId) {
        return [];
      }
      const theme = findTheme(activeThemeId);
      return theme?.backgrounds ?? [];
    },

    getActiveBackground(): ActiveBackground | null {
      return activeBackground;
    },

    setBackground(index: number): boolean {
      if (!activeThemeId) {
        return false;
      }
      const theme = findTheme(activeThemeId);
      const backgrounds = theme?.backgrounds ?? [];
      if (index < 0 || index >= backgrounds.length) {
        return false;
      }

      applyBackgroundEntry(backgrounds[index]!, "theme", index);
      writeBackgroundPreference(activeThemeId, { index });
      return true;
    },

    setCustomBackground(url: string, mode?: "cover" | "contain" | "tile"): void {
      const resolvedMode = mode ?? "cover";
      const entry: ThemeBackgroundEntry = { url, mode: resolvedMode };
      applyBackgroundEntry(entry, "custom", null);

      if (activeThemeId) {
        writeBackgroundPreference(activeThemeId, {
          index: null,
          custom: { url, mode: resolvedMode },
        });
      }
    },

    clearCustomBackground(): void {
      if (activeThemeId) {
        clearBackgroundPreference(activeThemeId);
        const theme = findTheme(activeThemeId);
        const backgrounds = theme?.backgrounds ?? [];
        if (backgrounds.length > 0) {
          applyBackgroundEntry(backgrounds[0]!, "theme", 0);
        } else {
          backgroundController.apply(undefined);
          activeBackground = null;
        }
      }
    },

    getThemePalette(themeId: string): Record<string, string> | null {
      const theme = findTheme(themeId);
      if (!theme) {
        return null;
      }
      const full = deriveFullPalette(theme.palette, theme.terminal);
      const result: Record<string, string> = {};
      for (const [key, cssVar] of Object.entries(GHOST_THEME_CSS_VARS) as [string, string][]) {
        const value = full[key as keyof FullThemePalette];
        result[cssVar] = String(value);
      }
      // Include terminal colors if the theme provides them
      if (theme.terminal) {
        for (const [key, value] of Object.entries(theme.terminal)) {
          if (value) {
            result[`--ghost-terminal-${key}`] = value;
          }
        }
      }
      return result;
    },

    pruneDisabledPluginThemes(): void {
      const snapshot = pluginRegistry.getSnapshot();
      const enabledIds = new Set(snapshot.plugins.filter((p) => p.enabled).map((p) => p.id));
      discoveredThemes = discoveredThemes.filter((t) => enabledIds.has(t.pluginId));
      if (activeThemeId && !findTheme(activeThemeId)) {
        activeThemeId = null;
        activeBackground = null;
        const fallback = discoveredThemes[0] ? findTheme(discoveredThemes[0].id) : undefined;
        if (fallback) {
          applyTheme(fallback);
          activeThemeId = fallback.id;
        }
      }
    },
  };
}
