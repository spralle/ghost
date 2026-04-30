/**
 * Plugin registry hydration — bootstraps tenant manifest, config, themes,
 * action contributions, and registry subscription.
 */

import { bootstrapShellWithTenantManifest } from "./app/bootstrap.js";
import type { ShellRuntime } from "./app/types.js";
import { getShellBootstrap } from "./bootstrap-shell.js";
import { registerConfigurationServiceCapability } from "./config-service-registration.js";
import { createShellConfigService, runPersistenceMigrations } from "./config-service-setup.js";
import { readGroupSelectionContext, writeGroupSelectionContext } from "./context/runtime-state.js";
import { createGhostApiDeps } from "./plugin-api/ghost-api-deps-factory.js";
import { createPluginServicesBridge } from "./plugin-service-bridge.js";
import { createDefaultShellKeybindingContract } from "./shell-runtime/default-shell-keybindings.js";
import { createWorkspaceSwitchDeps, refreshActionContributions, renderParts } from "./shell-wiring.js";
import { createQuickPickBridge } from "./ui/quick-pick/quick-pick-bridge.js";

export interface HydrateOptions {
  readonly tenantId: string;
  readonly defaultThemeId: string;
}

export async function hydratePluginRegistry(
  root: HTMLElement,
  runtime: ShellRuntime,
  isActive: () => boolean,
  options: HydrateOptions,
): Promise<void> {
  const modalLayer = root.querySelector<HTMLElement>('.shell-layer[data-layer="modal"]');
  const quickPickBridge = createQuickPickBridge(modalLayer ?? undefined);

  try {
    const apiDeps = createGhostApiDeps(runtime, quickPickBridge, {
      getWorkspaceSwitchDeps: () => createWorkspaceSwitchDeps(root, runtime),
    });

    const bootstrap = getShellBootstrap(runtime);

    const { configService } = await createShellConfigService();

    const state = await bootstrapShellWithTenantManifest({
      tenantId: options.tenantId,
      configurationService: configService,
      enableByDefault: true,
      defaultThemeId: options.defaultThemeId,
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

    applyHydratedState(root, runtime, state, configService);
    subscribeToRegistryChanges(root, runtime, isActive);

    renderAllPanels(root, runtime);
  } catch (error) {
    quickPickBridge.dispose();
    console.error("[shell] plugin registry hydration skipped", error);
  }
}

function applyHydratedState(
  _root: HTMLElement,
  runtime: ShellRuntime,
  state: {
    registry: ShellRuntime["registry"];
    disposePluginConfigSync?: (() => void) | null;
    themeRegistry?: ShellRuntime["themeRegistry"];
  },
  configService: Awaited<ReturnType<typeof createShellConfigService>>["configService"],
): void {
  runtime.registry = state.registry;
  runtime.services = createPluginServicesBridge(state.registry);
  runtime.pluginConfigSyncDispose = state.disposePluginConfigSync ?? null;
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

  runtime.registry.registerBuiltinPlugin(createDefaultShellKeybindingContract());
  refreshActionContributions(runtime);
}

function subscribeToRegistryChanges(root: HTMLElement, runtime: ShellRuntime, isActive: () => boolean): void {
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
}

function renderAllPanels(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderPanels(root, runtime);
  renderParts(root, runtime);
  getShellBootstrap(runtime).renderEdgeSlots(root, runtime);
  getShellBootstrap(runtime).renderLayerSurfaces(root, runtime);
}
