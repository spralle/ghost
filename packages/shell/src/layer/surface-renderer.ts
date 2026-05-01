import type { ElementTransitionHook, PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { ELEMENT_TRANSITION_HOOK_ID, HOOK_REGISTRY_SERVICE_ID } from "@ghost-shell/contracts";
import type { LayerRegistry, ShellLayerSurface } from "@ghost-shell/layer";
import {
  computeExclusiveZones,
  createFocusGrabManager,
  createKeyboardExclusiveManager,
  createSessionLockManager,
  type FocusGrabManager,
  type KeyboardExclusiveManager,
  type SessionLockManager,
} from "@ghost-shell/layer";
import { evaluateContributionPredicate } from "@ghost-shell/plugin-system";
import type { ShellRuntime } from "../app/types.js";
import { safeUnmount } from "../federation-mount-utils.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import type { HookRegistry } from "../hook-registry.js";
import { composeSurfaceKey, type MountSurfaceComponentFn } from "./surface-mount-utils.js";
import { type ReconcilerContext, reconcileLayerContainer } from "./surface-reconciler.js";
import { getLayoutModeService } from "../services/layout-mode-service-registration.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { MountSurfaceComponentFn } from "./surface-mount-utils.js";

export interface SurfaceMountState {
  surfaceId: string;
  pluginId: string;
  surface: PluginLayerSurfaceContribution;
  element: HTMLDivElement;
  cleanup: (() => void) | null;
  mountKey: string;
  generation: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface LayerSurfaceRendererOptions {
  federationRuntime: ShellFederationRuntime;
  layerRegistry: LayerRegistry;
  layerHost: HTMLElement;
  onSurfaceMounted?: (surfaceId: string, pluginId: string) => void;
  onSurfaceMountError?: (surfaceId: string, pluginId: string, error: unknown) => void;
}

export interface LayerSurfaceRenderer {
  renderLayerSurfaces(runtime: ShellRuntime): void;
  dispose(): void;
  registerBuiltInSurfaceMount(component: string, mountFn: MountSurfaceComponentFn): void;
  readonly focusGrabManager: FocusGrabManager;
  readonly sessionLockManager: SessionLockManager;
  readonly keyboardExclusiveManager: KeyboardExclusiveManager;
}

export function createLayerSurfaceRenderer(options: LayerSurfaceRendererOptions): LayerSurfaceRenderer {
  const { federationRuntime, layerRegistry, layerHost } = options;
  const onSurfaceMounted = options.onSurfaceMounted;
  const onSurfaceMountError = options.onSurfaceMountError;
  const mounted = new Map<string, SurfaceMountState>();
  const mountedShellSurfaces = new Map<string, { element: HTMLElement; cleanup: (() => void) | null }>();
  const registeredRemoteIds = new Set<string>();
  const builtInSurfaceMounts = new Map<string, MountSurfaceComponentFn>();
  const dismissedSurfaces = new Set<string>();
  let generation = 0;

  const keyboardExclusiveManager = createKeyboardExclusiveManager();
  const focusGrabManager = createFocusGrabManager(keyboardExclusiveManager);
  const sessionLockManager = createSessionLockManager({ layerHost, keyboardExclusiveManager });

  layerRegistry.setSessionLockCheck((z) => sessionLockManager.canAddSurface(z));

  layerRegistry.setOnSurfacesRemoved((entries) => {
    for (const { surfaceId, pluginId } of entries) {
      const key = composeSurfaceKey(pluginId, surfaceId);
      const state = mounted.get(key);
      if (!state) continue;
      cleanupSurfaceBehaviors(key);
      safeUnmount(state.cleanup);
      state.element.remove();
      mounted.delete(key);
      dismissedSurfaces.delete(key);
    }
  });

  function cleanupSurfaceBehaviors(key: string): void {
    focusGrabManager.releaseFocus(key);
    keyboardExclusiveManager.popExclusive(key);
    if (sessionLockManager.getActiveLockSurfaceId() === key) {
      sessionLockManager.releaseLock(key);
    }
  }

  function maybeActivateSurfaceBehaviors(
    key: string,
    target: HTMLElement,
    surface: PluginLayerSurfaceContribution,
  ): void {
    if (surface.focusGrab) {
      const container = target.parentElement;
      if (container) {
          focusGrabManager.grabFocus({
          surfaceId: key,
          surfaceElement: target as HTMLDivElement,
          layerContainer: container,
          config: surface.focusGrab,
          onDismiss: () => {
            dismissedSurfaces.add(key);
            const state = mounted.get(key);
            if (state) {
              safeUnmount(state.cleanup);
              cleanupSurfaceBehaviors(key);
              target.remove();
              mounted.delete(key);
            }
          },
        });
      }
    }

    if (surface.sessionLock) {
      const parent = target.parentElement;
      if (!parent) return;
      sessionLockManager.activateLock(key, target as HTMLDivElement, parent);
    }
  }

  function registerBuiltInSurfaceMount(component: string, mountFn: MountSurfaceComponentFn): void {
    builtInSurfaceMounts.set(component, mountFn);
  }

  function buildReconcilerContext(runtime: ShellRuntime): ReconcilerContext {
    const snapshot = runtime.registry.getSnapshot();
    const pluginSnapshotMap = new Map(snapshot.plugins.map((p) => [p.id, p]));
    return {
      mounted,
      dismissedSurfaces,
      registeredRemoteIds,
      builtInSurfaceMounts,
      layerRegistry,
      federationRuntime,
      focusGrabManager,
      pluginSnapshotMap,
      get generation() {
        return generation;
      },
      cleanupSurfaceBehaviors,
      maybeActivateSurfaceBehaviors,
      onSurfaceMounted,
      onSurfaceMountError,
      onSurfaceEntering(el: HTMLElement, _surfaceId: string, _pluginId: string) {
        const hookReg = runtime.registry.getService(HOOK_REGISTRY_SERVICE_ID) as HookRegistry | null;
        if (!hookReg) return;
        const hooks = hookReg.getHooks<ElementTransitionHook>(ELEMENT_TRANSITION_HOOK_ID);
        for (const hook of hooks) {
          hook.onEnter?.(el, { type: "surface", id: _surfaceId });
        }
      },
      async onSurfaceExiting(el: HTMLElement, _surfaceId: string, _pluginId: string) {
        const hookReg = runtime.registry.getService(HOOK_REGISTRY_SERVICE_ID) as HookRegistry | null;
        if (!hookReg) return;
        const hooks = hookReg.getHooks<ElementTransitionHook>(ELEMENT_TRANSITION_HOOK_ID);
        const exitPromises = hooks
          .filter((h) => typeof h.onExit === "function")
          .map((h) => h.onExit?.(el, { type: "surface", id: _surfaceId }));
        if (exitPromises.length > 0) {
          await Promise.all(exitPromises);
        }
      },
    };
  }

  function renderLayerSurfaces(runtime: ShellRuntime): void {
    generation += 1;
    const currentGeneration = generation;

    const allSurfaces = layerRegistry.getAllSurfaces();

    // Filter out surfaces whose when-condition evaluates to false
    const layoutFacts = getLayoutModeService()?.getContextFacts() ?? {};
    const visibleSurfaces = filterByWhenCondition(allSurfaces, layoutFacts).filter(
      (s) => !dismissedSurfaces.has(composeSurfaceKey(s.pluginId, s.surface.id))
    );


    // Build the desired set of surface IDs
    const desiredIds = new Set(visibleSurfaces.map((s) => composeSurfaceKey(s.pluginId, s.surface.id)));

    // Unmount surfaces no longer in desired set
    for (const [key, state] of mounted.entries()) {
      if (!desiredIds.has(key)) {
        cleanupSurfaceBehaviors(key);
        safeUnmount(state.cleanup);
        state.element.remove();
        mounted.delete(key);
      }
    }

    // Group surfaces by layer
    const surfacesByLayer = groupByLayer(visibleSurfaces);

    // Compute exclusive zones and set CSS custom properties
    const zones = computeExclusiveZones(visibleSurfaces);
    layerHost.style.setProperty("--layer-exclusive-top", `${zones.top}px`);
    layerHost.style.setProperty("--layer-exclusive-right", `${zones.right}px`);
    layerHost.style.setProperty("--layer-exclusive-bottom", `${zones.bottom}px`);
    layerHost.style.setProperty("--layer-exclusive-left", `${zones.left}px`);

    // Reconcile each layer container
    const ctx = buildReconcilerContext(runtime);
    for (const [layerName, surfaces] of surfacesByLayer) {
      const container = layerHost.querySelector<HTMLElement>(`.shell-layer[data-layer="${layerName}"]`);
      if (!container) continue;

      const sorted = [...surfaces].sort((a, b) => (a.surface.order ?? 0) - (b.surface.order ?? 0));
      reconcileLayerContainer(ctx, container, sorted, runtime, currentGeneration);
    }

    // Reconcile shell surfaces (imperative mount)
    reconcileShellSurfaces(layerHost, layerRegistry, mountedShellSurfaces);
  }

  function dispose(): void {
    const lockId = sessionLockManager.getActiveLockSurfaceId();
    if (lockId) sessionLockManager.releaseLock(lockId);

    for (const state of mounted.values()) {
      cleanupSurfaceBehaviors(state.surfaceId);
      safeUnmount(state.cleanup);
      state.element.remove();
    }
    mounted.clear();

    for (const [, state] of mountedShellSurfaces) {
      if (state.cleanup) state.cleanup();
      state.element.remove();
    }
    mountedShellSurfaces.clear();

    registeredRemoteIds.clear();
    dismissedSurfaces.clear();
    keyboardExclusiveManager.dispose();
    generation += 1;
  }

  return {
    renderLayerSurfaces,
    dispose,
    registerBuiltInSurfaceMount,
    focusGrabManager,
    sessionLockManager,
    keyboardExclusiveManager,
  };
}

// ---------------------------------------------------------------------------
// When-condition evaluation
// ---------------------------------------------------------------------------

/** Filter surfaces by their `when` predicate. Surfaces without `when` always pass. */
export function filterByWhenCondition(
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
  facts: Record<string, unknown> = {},
): Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }> {
  return surfaces.filter((entry) => evaluateContributionPredicate(entry.surface.when, facts));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByLayer(
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
): Map<string, Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>> {
  const map = new Map<string, Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>>();
  for (const entry of surfaces) {
    let list = map.get(entry.surface.layer);
    if (!list) {
      list = [];
      map.set(entry.surface.layer, list);
    }
    list.push(entry);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Shell surface reconciliation
// ---------------------------------------------------------------------------

function reconcileShellSurfaces(
  layerHost: HTMLElement,
  layerRegistry: LayerRegistry,
  mountedShellSurfaces: Map<string, { element: HTMLElement; cleanup: (() => void) | null }>,
): void {
  const allShell = layerRegistry.getAllShellSurfaces();
  const desiredIds = new Set(allShell.map((s) => s.id));

  // Remove stale shell surfaces
  for (const [id, state] of mountedShellSurfaces) {
    if (!desiredIds.has(id)) {
      if (state.cleanup) state.cleanup();
      state.element.remove();
      mountedShellSurfaces.delete(id);
    }
  }

  // Mount new shell surfaces
  for (const surface of allShell) {
    if (mountedShellSurfaces.has(surface.id)) continue;

    const container = layerHost.querySelector<HTMLElement>(`.shell-layer[data-layer="${surface.layer}"]`);
    if (!container) continue;

    const el = document.createElement("div");
    el.className = "layer-surface layer-surface--shell";
    el.dataset.shellSurface = surface.id;
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.pointerEvents = "auto";
    container.appendChild(el);

    const cleanupResult = surface.mount(el);
    const cleanup = typeof cleanupResult === "function" ? cleanupResult : null;
    mountedShellSurfaces.set(surface.id, { element: el, cleanup });
  }
}
