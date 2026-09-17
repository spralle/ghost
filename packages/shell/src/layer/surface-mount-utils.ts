import type { LayerSurfaceContext, PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { resolveModuleMountFn } from "@ghost-shell/contracts";
import type { PluginHost, ShellRuntime } from "../app/types.js";
import type { MountCleanup } from "../federation-mount-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MountSurfaceComponentFn = (
  target: HTMLElement,
  context: {
    surface: PluginLayerSurfaceContribution;
    pluginId: string;
    surfaceContext: LayerSurfaceContext;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

export type FederatedSurfaceMountFn = (target: HTMLElement, context: LayerSurfaceContext) => unknown;

// ---------------------------------------------------------------------------
// Surface mount resolution
// ---------------------------------------------------------------------------

export function resolveSurfaceMount(
  moduleValue: unknown,
  surface: PluginLayerSurfaceContribution,
): FederatedSurfaceMountFn | null {
  const fn = resolveModuleMountFn(moduleValue, {
    topLevelNames: ["mountSurface", "mount"],
    collectionName: "surfaces",
    collectionKeys: [surface.component, surface.id],
    checkDefault: true,
  });

  if (!fn) {
    return null;
  }

  return (target, context) => fn(target, context);
}

export function isMountCleanup(value: unknown): value is MountCleanup {
  if (value === undefined || typeof value === "function") {
    return true;
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    ("dispose" in value && typeof value.dispose === "function") ||
    ("unmount" in value && typeof value.unmount === "function")
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function composeSurfaceKey(pluginId: string, surfaceId: string): string {
  return `${pluginId}--${surfaceId}`;
}

export function createSurfaceMountKey(
  pluginId: string,
  surface: PluginLayerSurfaceContribution,
  runtime: PluginHost,
  pluginSnapshotMap?: Map<string, { enabled: boolean; lifecycle?: { state: string } }>,
): string {
  const pluginSnapshot = pluginSnapshotMap
    ? pluginSnapshotMap.get(pluginId)
    : runtime.registry.getSnapshot().plugins.find((p) => p.id === pluginId);
  if (!pluginSnapshot) {
    return `${pluginId}|${surface.id}|missing`;
  }
  const enabledState = pluginSnapshot.enabled ? "enabled" : "disabled";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  return [pluginId, surface.id, enabledState, lifecycleState].join("|");
}
