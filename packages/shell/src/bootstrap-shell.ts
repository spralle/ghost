import type { WindowBridgeEvent } from "@ghost-shell/bridge";
import { LayerRegistry } from "@ghost-shell/layer";
import type { ShellCoreApi } from "./app/contracts.js";
import type { ShellMigrationFlags } from "./app/migration-flags.js";
import { selectShellTransportPath } from "./app/migration-flags.js";
import { createShellCoreApi } from "./app/shell-core.js";
import type { ShellRuntime } from "./app/types.js";
import { createShellFederationRuntime } from "./federation-runtime.js";
import { createLayerSurfaceRenderer } from "./layer/surface-renderer.js";
import { createDefaultEdgeSlotsLayout } from "./layout.js";
import type { PluginActivationTriggerType } from "./plugin-registry.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";
import {
  initializeReactPanels,
  renderContextControlsPanel as renderContextControlsPanelView,
  renderPanels as renderPanelsView,
  renderParts as renderPartsView,
  renderSyncStatus as renderSyncStatusView,
} from "./shell-runtime/runtime-render.js";
import { createEdgeSlotRenderer } from "./ui/edge-slot-renderer.js";
import { getLayerRegistry, mountMainWindow, mountPopout } from "./ui/shell-mount.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShellBootstrapDeps {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  announce: (message: string) => void;
  dismissIntentChooser: () => void;
  primeEnabledPluginActivations: () => Promise<void>;
  publishWithDegrade: (event: WindowBridgeEvent) => void;
  refreshActionContributions: () => void;
  summarizeSelectionPriorities: () => string;
  renderContextControlsPanel: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
}

export interface ShellBootstrap {
  transportPath: "legacy-bridge" | "async-scomp-adapter";
  transportReason: "kill-switch-force-legacy" | "async-flag-enabled" | "default-legacy";
  core: ShellCoreApi;
  layerRegistry: LayerRegistry;
  initialize: (root: HTMLElement, runtime: ShellRuntime) => void;
  mountMainWindow: (root: HTMLElement, deps: MountDeps) => () => void;
  mountPopout: (root: HTMLElement, runtime: ShellRuntime, deps: MountDeps) => () => void;
  renderPanels: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderParts: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderSyncStatus: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderContextControlsPanel: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderEdgeSlots: (root: HTMLElement, runtime: ShellRuntime) => void;
  renderLayerSurfaces: (root: HTMLElement, runtime: ShellRuntime) => void;
}

interface MountDeps {
  renderParts: () => void;
  renderLayerSurfaces: () => void;
  updateWindowReadOnlyState: () => void;
  setupResize: () => () => void;
  publishRestoreRequestOnUnload: () => void;
}

// ---------------------------------------------------------------------------
// Registry (per-runtime lookup)
// ---------------------------------------------------------------------------

const bootstrapByRuntime = new WeakMap<ShellRuntime, ShellBootstrap>();

export function registerShellBootstrap(runtime: ShellRuntime, bootstrap: ShellBootstrap): void {
  bootstrapByRuntime.set(runtime, bootstrap);
}

export function getShellBootstrap(runtime: ShellRuntime): ShellBootstrap {
  const bootstrap = bootstrapByRuntime.get(runtime);
  if (!bootstrap) {
    throw new Error("Shell bootstrap is not initialized for runtime.");
  }
  return bootstrap;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShellBootstrap(
  root: HTMLElement,
  runtime: ShellRuntime,
  flags: ShellMigrationFlags,
  deps: ShellBootstrapDeps,
): ShellBootstrap {
  const transportDecision = selectShellTransportPath(flags);
  const federationRuntime = createShellFederationRuntime();
  const edgeSlotRenderer = createEdgeSlotRenderer({ federationRuntime });

  // Create LayerRegistry early so it can be shared with plugin activation and mount.
  const layerRegistry = new LayerRegistry();
  layerRegistry.registerBuiltinLayers();

  let layerSurfaceRendererInstance: import("./layer/surface-renderer.js").LayerSurfaceRenderer | null = null;

  const effects = buildEffectsPort(deps, () => bootstrap);
  const runtimeHandlers = createRuntimeEventHandlers(root, runtime, {
    activatePluginForBoundary: (options) => effects.activatePluginForBoundary(options),
    announce: (message) => effects.announce(message),
    renderContextControlsPanel: () => effects.renderContextControlsPanel(),
    renderParts: () => effects.renderParts(),
    renderSyncStatus: () => effects.renderSyncStatus(),
    summarizeSelectionPriorities: () => effects.summarizeSelectionPriorities(),
  });

  const core = createShellCoreApi(runtime, runtimeHandlers);

  registerTopbarToggleAction(runtime);

  const bootstrap: ShellBootstrap = {
    transportPath: transportDecision.path,
    transportReason: transportDecision.reason,
    core,
    layerRegistry,
    initialize: (viewRoot, viewRuntime) => {
      initializeReactPanels(viewRoot, viewRuntime, buildPanelDeps(deps, core, effects));
    },
    mountMainWindow: (viewRoot, mountDeps) => mountMainWindow(viewRoot, { ...mountDeps, layerRegistry }),
    mountPopout: (viewRoot, viewRuntime, mountDeps) => mountPopout(viewRoot, viewRuntime, mountDeps),
    renderPanels: (viewRoot, viewRuntime) => renderPanelsView(viewRoot, viewRuntime),
    renderParts: (viewRoot, viewRuntime) => {
      renderPartsView(viewRoot, viewRuntime, buildPanelDeps(deps, core, effects));
    },
    renderSyncStatus: (viewRoot, viewRuntime) => renderSyncStatusView(viewRoot, viewRuntime),
    renderContextControlsPanel: (viewRoot, viewRuntime) => renderContextControlsPanelView(viewRoot, viewRuntime),
    renderEdgeSlots: (viewRoot, viewRuntime) => edgeSlotRenderer.renderEdgeSlots(viewRoot, viewRuntime),
    renderLayerSurfaces: (viewRoot, viewRuntime) => {
      renderLayerSurfacesLazy(
        viewRoot,
        viewRuntime,
        federationRuntime,
        () => layerSurfaceRendererInstance,
        (r) => {
          layerSurfaceRendererInstance = r;
        },
      );
    },
  };

  return bootstrap;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEffectsPort(deps: ShellBootstrapDeps, getBootstrap: () => ShellBootstrap) {
  return {
    activatePluginForBoundary: (options: {
      pluginId: string;
      triggerType: PluginActivationTriggerType;
      triggerId: string;
    }) => deps.activatePluginForBoundary(options),
    announce: (message: string) => deps.announce(message),
    publishWithDegrade: (event: WindowBridgeEvent) => deps.publishWithDegrade(event),
    renderContextControlsPanel: () => {
      const _b = getBootstrap();
      // Delegate to the bootstrap's own render method — but we need root+runtime.
      // The deps callback already closes over root+runtime from the caller.
      deps.renderContextControlsPanel();
    },
    renderParts: () => deps.renderParts(),
    renderSyncStatus: () => deps.renderSyncStatus(),
    summarizeSelectionPriorities: () => deps.summarizeSelectionPriorities(),
  };
}

function buildPanelDeps(deps: ShellBootstrapDeps, core: ShellCoreApi, effects: ReturnType<typeof buildEffectsPort>) {
  return {
    activatePluginForBoundary: (options: {
      pluginId: string;
      triggerType: PluginActivationTriggerType;
      triggerId: string;
    }) => effects.activatePluginForBoundary(options),
    applySelection: (event: Parameters<ShellCoreApi["applySelection"]>[0]) => core.applySelection(event),
    dismissIntentChooser: () => deps.dismissIntentChooser(),
    executeResolvedAction: (
      match: Parameters<ShellCoreApi["executeResolvedAction"]>[0],
      intent: Parameters<ShellCoreApi["executeResolvedAction"]>[1],
    ) => core.executeResolvedAction(match, intent),
    primeEnabledPluginActivations: () => deps.primeEnabledPluginActivations(),
    publishWithDegrade: (event: WindowBridgeEvent) => effects.publishWithDegrade(event),
    refreshActionContributions: () => deps.refreshActionContributions(),
    renderContextControlsPanel: () => effects.renderContextControlsPanel(),
    renderParts: () => effects.renderParts(),
    renderSyncStatus: () => effects.renderSyncStatus(),
  };
}

function registerTopbarToggleAction(runtime: ShellRuntime): void {
  runtime.runtimeActionRegistry.set("shell.topbar.toggle", () => {
    if (!runtime.layout.edgeSlots) {
      runtime.layout = { ...runtime.layout, edgeSlots: createDefaultEdgeSlotsLayout() };
    }
    const edgeSlots = runtime.layout.edgeSlots!;
    edgeSlots.top.visible = !edgeSlots.top.visible;
    runtime.layout = { ...runtime.layout, edgeSlots };
  });
}

function renderLayerSurfacesLazy(
  viewRoot: HTMLElement,
  viewRuntime: ShellRuntime,
  federationRuntime: ReturnType<typeof createShellFederationRuntime>,
  getInstance: () => import("./layer/surface-renderer.js").LayerSurfaceRenderer | null,
  setInstance: (r: import("./layer/surface-renderer.js").LayerSurfaceRenderer) => void,
): void {
  const layerRegistry = getLayerRegistry();
  if (!layerRegistry) return;
  const layerHost = viewRoot.querySelector<HTMLElement>("#layer-host");
  if (!layerHost) return;
  let instance = getInstance();
  if (!instance) {
    instance = createLayerSurfaceRenderer({ federationRuntime, layerRegistry, layerHost });
    setInstance(instance);
  }
  instance.renderLayerSurfaces(viewRuntime);
}
