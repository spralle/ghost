import type { PluginContract } from "@ghost-shell/contracts";
import { LayerRegistry } from "@ghost-shell/layer";
import { readUserThemePreference } from "@ghost-shell/theme";
import { registerBuiltinServices } from "../builtin-service-descriptors.js";
import { createPluginConfigSyncController, deriveNamespace } from "../plugin-config-sync-controller.js";
import { createShellPluginRegistry } from "../plugin-registry.js";
import { activateByStartupEvent } from "../plugin-registry-activation.js";
import { activatePreferredThemePlugin, DEFAULT_THEME_PLUGIN_ID } from "../theme-activation.js";
import { createThemeRegistry } from "../theme-registry.js";
import type { ShellBootstrapOptions, ShellBootstrapState } from "./types.js";
import { parseTenantManifestFallback } from "./utils.js";

async function fetchManifestFromEndpoint(manifestUrl: string): Promise<unknown> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tenant manifest from '${manifestUrl}' (${response.status})`);
  }

  return response.json();
}

function isLoopbackEntry(entry: string): boolean {
  if (entry.startsWith("local://")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(entry);
  } catch {
    return false;
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return false;
  }

  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1";
}

function resolveBootstrapMode(entries: readonly string[]): "inner-loop" | "integration" {
  return entries.some((entry) => !isLoopbackEntry(entry)) ? "integration" : "inner-loop";
}

export async function bootstrapShellWithTenantManifest(options: ShellBootstrapOptions): Promise<ShellBootstrapState> {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const manifestUrl = `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
  const fetchManifest = options.fetchManifest ?? fetchManifestFromEndpoint;
  const rawManifest = await fetchManifest(manifestUrl);
  const parsedManifest = parseTenantManifestFallback(rawManifest);

  // Create LayerRegistry before plugin activation so layer contributions
  // are registered when plugins activate (not deferred until mount).
  const layerRegistry = options.layerRegistry ?? new LayerRegistry();
  if (!options.layerRegistry) {
    layerRegistry.registerBuiltinLayers();
  }

  const registry = createShellPluginRegistry({
    apiDeps: options.apiDeps,
    layerRegistry,
  });
  registry.registerManifestDescriptors(parsedManifest.tenantId, parsedManifest.plugins);
  options.onProgress?.(registry);

  let disposePluginConfigSync: (() => void) | null = null;
  if (options.configurationService) {
    const pluginConfigSyncController = createPluginConfigSyncController({
      registry,
      configurationService: options.configurationService,
      deriveNamespace,
      pluginIds: parsedManifest.plugins.map((plugin) => plugin.id),
      defaultEnabled: options.enableByDefault ?? false,
    });
    await pluginConfigSyncController.applySnapshot();
    disposePluginConfigSync = pluginConfigSyncController.start();
  }

  if (options.enableByDefault && !options.configurationService) {
    for (const descriptor of parsedManifest.plugins) {
      await registry.setEnabled(descriptor.id, true);
    }
  }

  // Activate the preferred theme plugin first — theme plugins contribute
  // palette data and have no service dependencies of their own.
  const themePref = readUserThemePreference();
  const preferredPluginId = themePref?.pluginId || undefined;
  await activatePreferredThemePlugin(registry, preferredPluginId, DEFAULT_THEME_PLUGIN_ID);

  // Initialize theme registry before builtin service registration so that
  // the ThemeService adapter can bridge to it.
  const themeRegistry = createThemeRegistry({
    pluginRegistry: registry,
    tenantDefaultThemeId: options.defaultThemeId,
    layerRegistry,
  });
  themeRegistry.discoverThemes();
  themeRegistry.applyInitialTheme();

  // Register main content as a shell surface for API visibility.
  // The actual rendering is handled by renderParts/edgeSlotRenderer.
  layerRegistry.registerShellSurface({
    id: "shell-main-content",
    layer: "main",
    order: 0,
    mount: () => {
      // No-op: the main layer container IS the dock grid host.
      // This registration exists for getAllShellSurfaces() visibility.
    },
  });

  // Register all builtin services (config, theme, plugin-registry,
  // plugin-management, activity-status, sync-status, context, keybinding,
  // hook-registry) in a single declarative pass.
  registerBuiltinServices({
    registry,
    themeRegistry,
    configurationService: options.configurationService,
    syncStatusDeps: options.syncStatusDeps,
    contextServiceDeps: options.contextServiceDeps,
    keybindingServiceDeps: options.keybindingServiceDeps,
  });

  // Now activate onStartup plugins — all 7 builtin services are available.
  const activationResult = await activateByStartupEvent(
    registry,
    options.onProgress ? () => options.onProgress?.(registry) : undefined,
  );

  if (activationResult.failed.length > 0) {
    console.warn(
      "[shell] plugin activation summary —",
      `activated: ${activationResult.activated.length},`,
      `failed: ${activationResult.failed.length}`,
      activationResult.failed,
    );
  } else {
    console.info("[shell] plugin activation summary —", `activated: ${activationResult.activated.length}, all OK`);
  }

  const snapshot = registry.getSnapshot();

  return {
    mode: resolveBootstrapMode(parsedManifest.plugins.map((plugin) => plugin.entry)),
    loadedPlugins: snapshot.plugins
      .map((plugin) => plugin.contract)
      .filter((plugin): plugin is PluginContract => plugin !== null),
    registry,
    layerRegistry,
    themeRegistry,
    disposePluginConfigSync,
  };
}

const emptyRegistry = createShellPluginRegistry();
emptyRegistry.registerManifestDescriptors("local", []);

const defaultLayerRegistry = new LayerRegistry();
defaultLayerRegistry.registerBuiltinLayers();

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
  registry: emptyRegistry,
  layerRegistry: defaultLayerRegistry,
  disposePluginConfigSync: null,
};
