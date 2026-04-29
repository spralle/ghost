import type { PartRenderer, PartRendererRegistry, PartRenderHandle } from "@ghost-shell/contracts";
import type { ShellPartHostAdapter } from "./app/contracts.js";
import type { PluginHost, ShellRuntime } from "./app/types.js";
import { ensureRemoteRegistered, normalizeCleanup, safeUnmount } from "./federation-mount-utils.js";
import { createShellFederationRuntime, type ShellFederationRuntime } from "./federation-runtime.js";
import {
  resolvePartArgs,
  resolvePartDefinitionId,
  resolvePartInstanceId,
  resolvePartMount,
} from "./part-mount-resolution.js";
import { createPartRendererRegistry } from "./part-renderer-registry.js";
import type { ComposedShellPart } from "./ui/parts-rendering.js";

interface PartModuleHostEntry {
  target: HTMLElement;
  cleanup: (() => void) | null;
  mountKey: string;
}

interface PartModuleHostOptions {
  federationRuntime?: ShellFederationRuntime;
  rendererRegistry?: PartRendererRegistry;
}

export interface PartModuleHostRuntime {
  syncRenderedParts(root: HTMLElement, parts: ComposedShellPart[]): Promise<void>;
  unmountAll(): void;
}

export function createPartModuleHostRuntime(
  runtime: ShellRuntime,
  options: PartModuleHostOptions = {},
): PartModuleHostRuntime {
  const federationRuntime = options.federationRuntime ?? createShellFederationRuntime();
  const rendererRegistry = options.rendererRegistry ?? createPartRendererRegistry();
  const mounted = new Map<string, PartModuleHostEntry>();
  const registeredRemoteIds = new Set<string>();
  let generation = 0;

  return {
    unmountAll() {
      for (const [partId, entry] of mounted.entries()) {
        safeUnmount(entry.cleanup);
        mounted.delete(partId);
      }
      generation += 1;
    },
    async syncRenderedParts(root, parts) {
      generation += 1;
      const currentGeneration = generation;
      const registrySnapshot = runtime.registry.getSnapshot();
      const pluginsById = new Map(registrySnapshot.plugins.map((plugin) => [plugin.id, plugin]));
      const visiblePartsById = new Map(parts.map((part) => [resolvePartInstanceId(part), part]));
      const contentTargets = collectTargetsByPart(root, "partContentFor");
      const fallbackTargets = collectTargetsByPart(root, "partFallbackFor");

      for (const [partId, entry] of mounted.entries()) {
        const shouldUnmount = !visiblePartsById.has(partId) || contentTargets.get(partId) !== entry.target;
        if (shouldUnmount) {
          safeUnmount(entry.cleanup);
          mounted.delete(partId);
        }
      }

      const mountPromises: Promise<void>[] = [];
      for (const part of parts) {
        const instanceId = resolvePartInstanceId(part);
        const target = contentTargets.get(instanceId);
        if (!target) {
          continue;
        }

        const fallbackTarget = fallbackTargets.get(instanceId) ?? null;
        const mountKey = createPartMountKey(part, pluginsById.get(part.pluginId));

        const existing = mounted.get(instanceId);
        if (existing && existing.target === target && existing.mountKey === mountKey) {
          hideFallback(fallbackTarget);
          continue;
        }

        if (existing) {
          safeUnmount(existing.cleanup);
          mounted.delete(instanceId);
        }

        mountPromises.push(
          mountPart({
            fallbackTarget,
            federationRuntime,
            isCurrent: () => generation === currentGeneration && visiblePartsById.has(instanceId),
            mountKey,
            mounted,
            part,
            pluginSnapshot: pluginsById.get(part.pluginId),
            registeredRemoteIds,
            rendererRegistry,
            runtime,
            target,
          }),
        );
      }

      await Promise.all(mountPromises);
    },
  };
}

export function createShellPartHostAdapter(
  runtime: ShellRuntime,
  options: PartModuleHostOptions = {},
): ShellPartHostAdapter {
  const hostRuntime = createPartModuleHostRuntime(runtime, options);
  return {
    syncRenderedParts: (root, parts) => hostRuntime.syncRenderedParts(root, parts),
    unmountAll: () => hostRuntime.unmountAll(),
  };
}

interface MountPartOptions {
  fallbackTarget: HTMLElement | null;
  federationRuntime: ShellFederationRuntime;
  isCurrent: () => boolean;
  mountKey: string;
  mounted: Map<string, PartModuleHostEntry>;
  part: ComposedShellPart;
  pluginSnapshot: ReturnType<PluginHost["registry"]["getSnapshot"]>["plugins"][number] | undefined;
  registeredRemoteIds: Set<string>;
  rendererRegistry: PartRendererRegistry;
  runtime: ShellRuntime;
  target: HTMLElement;
}

async function mountPart(options: MountPartOptions): Promise<void> {
  const {
    fallbackTarget,
    federationRuntime,
    isCurrent,
    mountKey,
    mounted,
    part,
    pluginSnapshot,
    registeredRemoteIds,
    rendererRegistry,
    runtime,
    target,
  } = options;

  const builtinModule = runtime.registry.getBuiltinModule(part.pluginId);

  if (!builtinModule) {
    ensureRemoteRegistered(
      part.pluginId,
      registeredRemoteIds,
      () => pluginSnapshot?.descriptor,
      (desc) => federationRuntime.registerRemote(desc),
    );
  }

  try {
    const remoteModule = builtinModule ?? (await federationRuntime.loadRemoteModule(part.pluginId, "./pluginParts"));

    if (!isCurrent()) {
      return;
    }

    const partId = resolvePartDefinitionId(part);
    const renderer = rendererRegistry.getRendererFor(partId, part.pluginId, remoteModule);

    if (renderer) {
      const handle = mountViaRenderer(renderer, target, part, runtime, remoteModule);
      mountedFromHandle(handle, resolvePartInstanceId(part), target, mountKey, mounted);
      hideFallback(fallbackTarget);
      return;
    }

    // Legacy fallback: direct mount resolution (for backward compat during transition)
    const mountFn = resolvePartMount(remoteModule, part);
    if (!mountFn) {
      showFallback(target, fallbackTarget);
      return;
    }

    const cleanupResult = await mountFn(target, {
      part,
      instanceId: resolvePartInstanceId(part),
      definitionId: resolvePartDefinitionId(part),
      args: resolvePartArgs(part),
      runtime,
    });
    const cleanup = normalizeCleanup(cleanupResult);

    if (!isCurrent()) {
      safeUnmount(cleanup);
      return;
    }

    mounted.set(resolvePartInstanceId(part), {
      target,
      cleanup,
      mountKey,
    });
    hideFallback(fallbackTarget);
  } catch (error: unknown) {
    console.error(
      `[shell:part-host] failed to mount part '${part.component ?? part.definitionId ?? part.id}' from plugin '${part.pluginId}'`,
      error,
    );
    showFallback(target, fallbackTarget);
  }
}

function mountViaRenderer(
  renderer: PartRenderer,
  container: HTMLElement,
  part: ComposedShellPart,
  runtime: ShellRuntime,
  module: unknown,
): PartRenderHandle {
  return renderer.mount({
    container,
    mountContext: {
      part: { id: part.id, title: part.title ?? part.id, component: part.component ?? part.id },
      instanceId: resolvePartInstanceId(part),
      definitionId: resolvePartDefinitionId(part),
      args: resolvePartArgs(part),
      runtime: { services: runtime.services, registry: runtime.registry },
    },
    partId: resolvePartDefinitionId(part),
    pluginId: part.pluginId,
    module,
  });
}

function mountedFromHandle(
  handle: PartRenderHandle,
  instanceId: string,
  target: HTMLElement,
  mountKey: string,
  mounted: Map<string, PartModuleHostEntry>,
): void {
  mounted.set(instanceId, {
    target,
    cleanup: () => handle.dispose(),
    mountKey,
  });
}

function createPartMountKey(
  part: ComposedShellPart,
  pluginSnapshot: ReturnType<PluginHost["registry"]["getSnapshot"]>["plugins"][number] | undefined,
): string {
  if (!pluginSnapshot) {
    return `${part.pluginId}|missing`;
  }

  const enabledState =
    typeof pluginSnapshot.enabled === "boolean" ? (pluginSnapshot.enabled ? "enabled" : "disabled") : "enabled:unknown";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  const lifecycleTransition = pluginSnapshot.lifecycle?.lastTransitionAt ?? "transition:none";
  const failureCode = pluginSnapshot.failure?.code ?? "failure:none";

  return [
    part.pluginId,
    enabledState,
    lifecycleState,
    lifecycleTransition,
    pluginSnapshot.contract ? "contract:present" : "contract:missing",
    failureCode,
  ].join("|");
}

function collectTargetsByPart(
  root: HTMLElement,
  datasetKey: "partContentFor" | "partFallbackFor",
): Map<string, HTMLElement> {
  const selector = datasetKey === "partContentFor" ? "[data-part-content-for]" : "[data-part-fallback-for]";
  const map = new Map<string, HTMLElement>();

  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    const partId = element.dataset[datasetKey];
    if (!partId) {
      continue;
    }

    map.set(partId, element);
  }

  return map;
}

function showFallback(target: HTMLElement, fallbackTarget: HTMLElement | null): void {
  target.innerHTML = "";
  if (fallbackTarget) {
    fallbackTarget.hidden = false;
  }
}

function hideFallback(fallbackTarget: HTMLElement | null): void {
  if (fallbackTarget) {
    fallbackTarget.hidden = true;
  }
}
