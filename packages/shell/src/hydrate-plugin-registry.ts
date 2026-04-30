// hydrate-plugin-registry.ts — Extracted hydration logic for the shell plugin registry.
//
// Orchestrates the full plugin bootstrap lifecycle: config service creation,
// tenant manifest bootstrap, service bridge wiring, keybinding registration,
// and registry subscription for reactive UI updates.

import { bootstrapShellWithTenantManifest } from "./app/bootstrap.js";
import type { ShellRuntime } from "./app/types.js";
import { getShellBootstrap } from "./bootstrap-shell.js";
import { registerConfigurationServiceCapability } from "./config-service-registration.js";
import { createShellConfigService, runPersistenceMigrations } from "./config-service-setup.js";
import { readGroupSelectionContext, writeGroupSelectionContext } from "./context/runtime-state.js";
import { createGhostApiDeps } from "./plugin-api/ghost-api-deps-factory.js";
import { createPluginServicesBridge } from "./plugin-service-bridge.js";
import { createDefaultShellKeybindingContract } from "./shell-runtime/default-shell-keybindings.js";
import { refreshActionContributions, renderParts, ShellWiringContext } from "./shell-wiring.js";
import { createQuickPickBridge } from "./ui/quick-pick/quick-pick-bridge.js";

/**
 * Explicit configuration for the shell hydration phase.
 * Values that were previously buried in the hydration logic
 * are now passed as structured config from the call site.
 */
export interface ShellHydrationConfig {
  readonly tenantId: string;
  readonly defaultThemeId: string;
  readonly enableByDefault: boolean;
}

/**
 * Hydrate the plugin registry: bootstrap tenant plugins, wire services,
 * register keybindings, and subscribe to registry changes for reactive UI.
 */
export async function hydratePluginRegistry(
  root: HTMLElement,
  runtime: ShellRuntime,
  isActive: () => boolean,
  config: ShellHydrationConfig,
): Promise<void> {
  const modalLayer = root.querySelector<HTMLElement>('.shell-layer[data-layer="modal"]');
  const quickPickBridge = createQuickPickBridge(modalLayer ?? undefined);
  const ctx = new ShellWiringContext(root, runtime);
  try {
    const apiDeps = createGhostApiDeps(runtime, quickPickBridge, {
      getWorkspaceSwitchDeps: () => ctx.createWorkspaceSwitchDeps(),
    });

    const bootstrap = getShellBootstrap(runtime);

    const { configService } = await createShellConfigService();

    const state = await bootstrapShellWithTenantManifest({
      tenantId: config.tenantId,
      configurationService: configService,
      enableByDefault: config.enableByDefault,
      defaultThemeId: config.defaultThemeId,
      apiDeps,
      layerRegistry: bootstrap.layerRegistry,
      syncStatusDeps: {
        isSyncDegraded: () => runtime.syncDegraded,
      },
      contextServiceDeps: {
        getGroupSelectionContext: () => readGroupSelectionContext(runtime),
        applyContextValue: (_key, value) => {
          if (!runtime.syncDegraded) {
            writeGroupSelectionContext(runtime, value);
          }
        },
      },
      keybindingServiceDeps: {
        getOverrideManager: () => runtime.keybindingOverrideManager,
        getKeybindings: () => runtime.actionSurface.keybindings,
      },
      onProgress: (registry) => {
        if (!isActive()) return;
        runtime.registry = registry;
        getShellBootstrap(runtime).renderPanels(root, runtime);
      },
    });

    if (!isActive()) {
      state.disposePluginConfigSync?.();
      quickPickBridge.dispose();
      return;
    }

    hydrateServices(runtime, state, configService);
    hydrateKeybindings(runtime);
    hydrateRendering(root, runtime, isActive);
  } catch (error) {
    quickPickBridge.dispose();
    console.error("[shell] plugin registry hydration skipped", error);
  }
}

// ---------------------------------------------------------------------------
// Focused helpers
// ---------------------------------------------------------------------------

/** Wire runtime services, config sync, and theme registry from bootstrap state. */
function hydrateServices(
  runtime: ShellRuntime,
  state: {
    registry: ShellRuntime["registry"];
    themeRegistry?: ShellRuntime["themeRegistry"];
    disposePluginConfigSync: (() => void) | null;
  },
  configService: Awaited<ReturnType<typeof createShellConfigService>>["configService"],
): void {
  runtime.registry = state.registry;
  runtime.services = createPluginServicesBridge(state.registry);
  runtime.pluginConfigSyncDispose = state.disposePluginConfigSync;
  runtime.themeRegistry = state.themeRegistry ?? null;

  try {
    registerConfigurationServiceCapability(runtime.registry, configService);
    const migrations = runPersistenceMigrations(configService);
    if (migrations.layout.migrated || migrations.context.migrated || migrations.keybindings.migrated) {
      console.info("[shell] persistence migrations completed", migrations);
    }
  } catch (configError) {
    console.error("[shell] config service creation failed, continuing without it", configError);
  }
}

/** Register the default shell keybinding contract and refresh action contributions. */
function hydrateKeybindings(runtime: ShellRuntime): void {
  runtime.registry.registerBuiltinPlugin(createDefaultShellKeybindingContract());
  refreshActionContributions(runtime);
}

/**
 * Subscribe to plugin registry changes for reactive UI updates.
 * Uses microtask batching to coalesce rapid notifications (e.g. cascade-disable).
 * Also performs the initial render pass.
 */
function hydrateRendering(root: HTMLElement, runtime: ShellRuntime, isActive: () => boolean): void {
  let renderPending = false;
  const registrySub = runtime.registry.subscribe(() => {
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(() => {
      renderPending = false;
      if (!isActive()) return;
      refreshActionContributions(runtime);
      runtime.themeRegistry?.pruneDisabledPluginThemes();
      runtime.themeRegistry?.discoverThemes();
      getShellBootstrap(runtime).renderPanels(root, runtime);
      renderParts(root, runtime);
      getShellBootstrap(runtime).renderEdgeSlots(root, runtime);
      getShellBootstrap(runtime).renderLayerSurfaces(root, runtime);
    });
  });
  runtime.registrySubscriptionDispose = () => registrySub.dispose();

  getShellBootstrap(runtime).renderPanels(root, runtime);
  renderParts(root, runtime);
  getShellBootstrap(runtime).renderEdgeSlots(root, runtime);
  getShellBootstrap(runtime).renderLayerSurfaces(root, runtime);
}
