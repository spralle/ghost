import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { InputBehavior, KeyboardInteractivity } from "@ghost-shell/contracts";
import type { FocusGrabManager, LayerRegistry } from "@ghost-shell/layer";
import {
  applyAutoStacking,
  applyInputBehavior,
  applyKeyboardInteractivity,
  applyVisualEffects,
  computeAnchorStyles,
  createLayerSurfaceContext,
} from "@ghost-shell/layer";
import type { PluginHost, ShellRuntime } from "../app/types.js";
import { ensureRemoteRegistered, normalizeCleanup, safeUnmount } from "../federation-mount-utils.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import { composeSurfaceKey, createSurfaceMountKey, resolveSurfaceMount } from "./surface-mount-utils.js";
import type { MountSurfaceComponentFn, SurfaceMountState } from "./surface-renderer.js";

// ---------------------------------------------------------------------------
// Dependencies context passed from the renderer
// ---------------------------------------------------------------------------

/** Single plugin entry from the registry snapshot. */
type PluginSnapshotEntry = ReturnType<PluginHost["registry"]["getSnapshot"]>["plugins"][number];

export interface ReconcilerContext {
  mounted: Map<string, SurfaceMountState>;
  dismissedSurfaces: Set<string>;
  registeredRemoteIds: Set<string>;
  builtInSurfaceMounts: Map<string, MountSurfaceComponentFn>;
  layerRegistry: LayerRegistry;
  federationRuntime: ShellFederationRuntime;
  focusGrabManager: FocusGrabManager;
  generation: number;
  pluginSnapshotMap: Map<string, PluginSnapshotEntry>;
  cleanupSurfaceBehaviors(key: string): void;
  maybeActivateSurfaceBehaviors(key: string, target: HTMLElement, surface: PluginLayerSurfaceContribution): void;
  onSurfaceMounted?: (surfaceId: string, pluginId: string) => void;
  onSurfaceMountError?: (surfaceId: string, pluginId: string, error: unknown) => void;
  /** Called when a surface element enters the DOM. Fires enter hooks. */
  onSurfaceEntering?: (el: HTMLElement, surfaceId: string, pluginId: string) => void;
  /** Called before a surface element exits the DOM. Returns a promise that resolves when exit animations complete. */
  onSurfaceExiting?: (el: HTMLElement, surfaceId: string, pluginId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// reconcileLayerContainer
// ---------------------------------------------------------------------------

export function reconcileLayerContainer(
  ctx: ReconcilerContext,
  container: HTMLElement,
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
  runtime: ShellRuntime,
  currentGeneration: number,
): void {
  const desiredIds = new Set(surfaces.map((s) => composeSurfaceKey(s.pluginId, s.surface.id)));

  removeStaleChildren(ctx, container, desiredIds);

  let previousElement: Element | null = null;
  for (const { pluginId, surface } of surfaces) {
    const key = composeSurfaceKey(pluginId, surface.id);
    let target = container.querySelector<HTMLDivElement>(`[data-surface-id="${key}"]`);

    if (!target) {
      console.log("[LAYER-DEBUG] reconciler: creating new surface element:", { key, pluginId, layer: surface.layer });
      target = createSurfaceElement(ctx, key, pluginId, surface);
      insertSurfaceElement(container, target, previousElement);
    }

    previousElement = target;

    const existing = ctx.mounted.get(key);
    const mountKey = createSurfaceMountKey(pluginId, surface, runtime, ctx.pluginSnapshotMap);

    if (existing && existing.element === target && existing.mountKey === mountKey) {
      continue;
    }

    if (existing) {
      safeUnmount(existing.cleanup);
      ctx.mounted.delete(key);
    }

    void mountSurfaceComponent(ctx, target, pluginId, surface, runtime, key, mountKey, currentGeneration);
  }

  applyAutoStackingForContainer(container, surfaces);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function removeStaleChildren(ctx: ReconcilerContext, container: HTMLElement, desiredIds: Set<string>): void {
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const surfaceId = child.dataset.surfaceId;
    if (surfaceId && !desiredIds.has(surfaceId) && !child.hasAttribute("data-exiting")) {
      const state = ctx.mounted.get(surfaceId);
      if (state) {
        ctx.cleanupSurfaceBehaviors(surfaceId);
        safeUnmount(state.cleanup);
        ctx.mounted.delete(surfaceId);
      }

      if (ctx.onSurfaceExiting) {
        child.setAttribute("data-exiting", "");
        child.style.pointerEvents = "none";
        void ctx.onSurfaceExiting(child, surfaceId, state?.pluginId ?? "").then(() => {
          child.remove();
        });
      } else {
        child.remove();
      }
    }
  }
}

function createSurfaceElement(
  ctx: ReconcilerContext,
  key: string,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
): HTMLDivElement {
  const target = document.createElement("div");
  target.className = "layer-surface";
  target.dataset.surfaceId = key;
  target.dataset.plugin = pluginId;

  const anchorStyles = computeAnchorStyles(surface);
  Object.assign(target.style, anchorStyles);

  const layerDef = ctx.layerRegistry.getLayer(surface.layer);
  applyInputBehavior(target, surface.inputBehavior ?? layerDef?.defaultPointer ?? InputBehavior.Opaque);
  applyKeyboardInteractivity(
    target,
    surface.keyboardInteractivity ?? layerDef?.defaultKeyboard ?? KeyboardInteractivity.None,
  );

  applyVisualEffects(target, surface.opacity, surface.backdropFilter);

  return target;
}

function insertSurfaceElement(container: HTMLElement, target: HTMLDivElement, previousElement: Element | null): void {
  if (previousElement?.nextSibling) {
    container.insertBefore(target, previousElement.nextSibling);
  } else if (!previousElement && container.firstChild) {
    container.insertBefore(target, container.firstChild);
  } else {
    container.appendChild(target);
  }
}

function applyAutoStackingForContainer(
  container: HTMLElement,
  surfaces: Array<{ pluginId: string; surface: PluginLayerSurfaceContribution }>,
): void {
  const stackedSurfaces = surfaces
    .map(({ pluginId: pid, surface: s }) => {
      const k = composeSurfaceKey(pid, s.id);
      const el = container.querySelector<HTMLElement>(`[data-surface-id="${k}"]`);
      return el ? { surfaceId: k, surface: s, element: el } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  applyAutoStacking(stackedSurfaces);
}

// ---------------------------------------------------------------------------
// mountSurfaceComponent
// ---------------------------------------------------------------------------

async function mountSurfaceComponent(
  ctx: ReconcilerContext,
  target: HTMLDivElement,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
  key: string,
  mountKey: string,
  expectedGeneration: number,
): Promise<void> {
  const container = target.parentElement as HTMLElement;
  const surfaceContext = createLayerSurfaceContext({
    surfaceId: key,
    element: target,
    layerName: surface.layer,
    layerContainer: container,
    layerRegistry: ctx.layerRegistry,
    focusGrabManager: ctx.focusGrabManager,
    onDismiss: () => {
      ctx.dismissedSurfaces.add(key);
      safeUnmount(ctx.mounted.get(key)?.cleanup ?? null);
      ctx.cleanupSurfaceBehaviors(key);
      target.remove();
      ctx.mounted.delete(key);
    },
    onLayerChange: () => {},
    onExclusiveZoneChange: () => {},
  });

  const builtInMount = ctx.builtInSurfaceMounts.get(surface.component);
  if (builtInMount) {
    await mountBuiltIn(
      ctx,
      builtInMount,
      target,
      pluginId,
      surface,
      runtime,
      key,
      mountKey,
      expectedGeneration,
      surfaceContext,
    );
    return;
  }

  await mountViaFederation(ctx, target, pluginId, surface, runtime, key, mountKey, expectedGeneration, surfaceContext);
}

async function mountBuiltIn(
  ctx: ReconcilerContext,
  builtInMount: MountSurfaceComponentFn,
  target: HTMLDivElement,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
  key: string,
  mountKey: string,
  expectedGeneration: number,
  surfaceContext: ReturnType<typeof createLayerSurfaceContext>,
): Promise<void> {
  try {
    const cleanupResult = await builtInMount(target, { surface, pluginId, surfaceContext, runtime });
    const cleanup = normalizeCleanup(cleanupResult);

    if (ctx.generation !== expectedGeneration) {
      safeUnmount(cleanup);
      return;
    }

    ctx.mounted.set(key, {
      surfaceId: key,
      pluginId,
      surface,
      element: target,
      cleanup,
      mountKey,
      generation: expectedGeneration,
    });
    ctx.maybeActivateSurfaceBehaviors(key, target, surface);
    ctx.onSurfaceMounted?.(key, pluginId);
    ctx.onSurfaceEntering?.(target, key, pluginId);
  } catch (err) {
    console.warn(`[shell] Built-in surface mount failed for "${key}":`, err);
    ctx.onSurfaceMountError?.(key, pluginId, err);
  }
}

async function mountViaFederation(
  ctx: ReconcilerContext,
  target: HTMLDivElement,
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: ShellRuntime,
  key: string,
  mountKey: string,
  expectedGeneration: number,
  surfaceContext: ReturnType<typeof createLayerSurfaceContext>,
): Promise<void> {
  const pluginSnapshot = ctx.pluginSnapshotMap.get(pluginId);

  ensureRemoteRegistered(
    pluginId,
    ctx.registeredRemoteIds,
    () => pluginSnapshot?.descriptor,
    (desc) => ctx.federationRuntime.registerRemote(desc),
  );

  try {
    console.log("[LAYER-DEBUG] mountViaFederation: loading remote module:", { pluginId, key });
    const remoteModule = await ctx.federationRuntime.loadRemoteModule(pluginId, "./pluginLayerSurfaces");
    console.log("[LAYER-DEBUG] mountViaFederation: remote module loaded:", { pluginId, moduleKeys: remoteModule ? Object.keys(remoteModule) : null });

    if (ctx.generation !== expectedGeneration) {
      return;
    }

    const mountFn = resolveSurfaceMount(remoteModule, surface);
    if (!mountFn) {
      console.log("[LAYER-DEBUG] mountViaFederation: no mount function resolved for:", { pluginId, component: surface.component });
      return;
    }

    // Plugin mount functions expect LayerSurfaceContext directly per @ghost-shell/contracts.
    // The MountSurfaceComponentFn type is for built-in shell mounts only.
    const cleanupResult = await (mountFn as unknown as (t: HTMLElement, ctx: typeof surfaceContext) => ReturnType<typeof mountFn>)(target, surfaceContext);
    const cleanup = normalizeCleanup(cleanupResult);
    console.log("[LAYER-DEBUG] mountViaFederation: mount SUCCESS:", { pluginId, key });

    if (ctx.generation !== expectedGeneration) {
      safeUnmount(cleanup);
      return;
    }

    ctx.mounted.set(key, {
      surfaceId: key,
      pluginId,
      surface,
      element: target,
      cleanup,
      mountKey,
      generation: expectedGeneration,
    });
    ctx.maybeActivateSurfaceBehaviors(key, target, surface);
    ctx.onSurfaceMounted?.(key, pluginId);
    ctx.onSurfaceEntering?.(target, key, pluginId);
  } catch (err) {
    console.log("[LAYER-DEBUG] mountViaFederation: FAILED:", { pluginId, key, error: err });
    console.warn(`[shell] Federation surface mount failed for "${key}" (plugin: ${pluginId}):`, err);
    ctx.onSurfaceMountError?.(key, pluginId, err);
  }
}
