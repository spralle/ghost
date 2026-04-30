import type {
  LayerDefinition,
  PluginLayerDefinition,
  PluginLayerSurfaceContribution,
} from "@ghost-shell/contracts/layer";
import { InputBehavior, KeyboardInteractivity } from "@ghost-shell/contracts/layer";
import { createLayerContainer, removeLayerContainer } from "./layer-dom.js";

/** Well-known identifier for shell-owned surfaces. */
export const SHELL_SURFACE_OWNER = "@ghost-shell/core";

/** A surface registered by the shell itself (bypasses pluginContributable). */
export interface ShellLayerSurface {
  /** Unique surface ID. */
  id: string;
  /** Target layer name. */
  layer: string;
  /** Imperative mount function; returns optional cleanup. */
  mount: (container: HTMLElement) => (() => void) | void;
  /** Sort order within layer. */
  order?: number;
}

/** The 7 built-in layers with generous z-order gaps for plugin insertion. */
export const BUILTIN_LAYERS: readonly LayerDefinition[] = [
  {
    name: "background",
    zOrder: 0,
    defaultKeyboard: KeyboardInteractivity.None,
    defaultPointer: InputBehavior.Passthrough,
    supportsSessionLock: false,
    pluginContributable: true,
  },
  {
    name: "bottom",
    zOrder: 100,
    defaultKeyboard: KeyboardInteractivity.None,
    defaultPointer: InputBehavior.Opaque,
    supportsSessionLock: false,
    pluginContributable: true,
  },
  {
    name: "main",
    zOrder: 200,
    defaultKeyboard: KeyboardInteractivity.OnDemand,
    defaultPointer: InputBehavior.Opaque,
    supportsSessionLock: false,
    pluginContributable: false,
  },
  {
    name: "floating",
    zOrder: 300,
    defaultKeyboard: KeyboardInteractivity.OnDemand,
    defaultPointer: InputBehavior.Opaque,
    supportsSessionLock: false,
    pluginContributable: true,
  },
  {
    name: "notification",
    zOrder: 400,
    defaultKeyboard: KeyboardInteractivity.None,
    defaultPointer: InputBehavior.ContentAware,
    supportsSessionLock: false,
    pluginContributable: true,
  },
  {
    name: "modal",
    zOrder: 500,
    defaultKeyboard: KeyboardInteractivity.Exclusive,
    defaultPointer: InputBehavior.Opaque,
    supportsSessionLock: false,
    pluginContributable: true,
  },
  {
    name: "overlay",
    zOrder: 600,
    defaultKeyboard: KeyboardInteractivity.Exclusive,
    defaultPointer: InputBehavior.Opaque,
    supportsSessionLock: true,
    pluginContributable: true,
  },
] as const;

export class LayerRegistry {
  private layers: Map<string, LayerDefinition> = new Map();
  private surfaces: Map<string, { surface: PluginLayerSurfaceContribution; pluginId: string }> = new Map();
  private shellSurfaces: Map<string, ShellLayerSurface> = new Map();
  private layerHost: HTMLElement | null = null;
  private sessionLockCheck: ((zOrder: number) => boolean) | null = null;
  private onSurfacesRemoved: ((entries: Array<{ surfaceId: string; pluginId: string }>) => void) | null = null;

  setSessionLockCheck(check: (zOrder: number) => boolean): void {
    this.sessionLockCheck = check;
  }

  setOnSurfacesRemoved(callback: (entries: Array<{ surfaceId: string; pluginId: string }>) => void): void {
    this.onSurfacesRemoved = callback;
  }

  setLayerHost(el: HTMLElement): void {
    this.layerHost = el;
  }

  registerBuiltinLayers(): void {
    for (const layer of BUILTIN_LAYERS) {
      this.layers.set(layer.name, { ...layer });
    }
  }

  registerPluginLayers(
    pluginId: string,
    definitions: PluginLayerDefinition[],
  ): { registered: string[]; denied: Array<{ name: string; reason: string }> } {
    const registered: string[] = [];
    const denied: Array<{ name: string; reason: string }> = [];

    for (const def of definitions) {
      const existing = this.layers.get(def.name);
      if (existing) {
        const owner = existing.pluginId ? `plugin '${existing.pluginId}'` : "built-in";
        denied.push({ name: def.name, reason: `Name conflicts with ${owner} layer` });
        continue;
      }

      // Detect z-order collisions with existing layers
      let zConflict: LayerDefinition | undefined;
      for (const layer of this.layers.values()) {
        if (layer.zOrder === def.zOrder) {
          zConflict = layer;
          break;
        }
      }
      if (zConflict) {
        const owner = zConflict.pluginId ? `plugin '${zConflict.pluginId}'` : "built-in";
        denied.push({
          name: def.name,
          reason: `z-order ${def.zOrder} conflicts with ${owner} layer '${zConflict.name}'`,
        });
        continue;
      }

      this.layers.set(def.name, {
        name: def.name,
        zOrder: def.zOrder,
        defaultKeyboard: def.defaultKeyboard ?? KeyboardInteractivity.None,
        defaultPointer: def.defaultPointer ?? InputBehavior.Opaque,
        supportsSessionLock: def.supportsSessionLock ?? false,
        pluginContributable: true,
        pluginId,
      });
      registered.push(def.name);

      if (this.layerHost) {
        createLayerContainer(this.layerHost, { name: def.name, zOrder: def.zOrder });
      }
    }

    return { registered, denied };
  }

  unregisterPluginLayers(pluginId: string): { removedLayers: string[]; affectedSurfaceIds: string[] } {
    const removedLayers: string[] = [];
    const affectedSurfaceIds: string[] = [];

    // Find layers owned by this plugin
    for (const [name, layer] of this.layers) {
      if (layer.pluginId === pluginId) {
        removedLayers.push(name);
      }
    }

    // Cascade: remove ALL surfaces on those layers (from all plugins)
    const removedEntries: Array<{ surfaceId: string; pluginId: string }> = [];
    for (const layerName of removedLayers) {
      for (const [surfaceId, entry] of this.surfaces) {
        if (entry.surface.layer === layerName) {
          affectedSurfaceIds.push(surfaceId);
          removedEntries.push({ surfaceId, pluginId: entry.pluginId });
        }
      }
      if (this.layerHost) {
        removeLayerContainer(this.layerHost, layerName);
      }
      this.layers.delete(layerName);
    }

    for (const id of affectedSurfaceIds) {
      this.surfaces.delete(id);
    }

    if (this.onSurfacesRemoved && removedEntries.length > 0) {
      this.onSurfacesRemoved(removedEntries);
    }

    return { removedLayers, affectedSurfaceIds };
  }

  registerSurface(pluginId: string, surface: PluginLayerSurfaceContribution): { success: boolean; reason?: string } {
    const validation = this.validateSurfaceContribution(surface);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }
    this.surfaces.set(surface.id, { surface, pluginId });
    return { success: true };
  }

  unregisterSurfaces(pluginId: string): string[] {
    const removed: string[] = [];
    const removedEntries: Array<{ surfaceId: string; pluginId: string }> = [];
    for (const [id, entry] of this.surfaces) {
      if (entry.pluginId === pluginId) {
        removed.push(id);
        removedEntries.push({ surfaceId: id, pluginId: entry.pluginId });
      }
    }
    for (const id of removed) {
      this.surfaces.delete(id);
    }
    if (this.onSurfacesRemoved && removedEntries.length > 0) {
      this.onSurfacesRemoved(removedEntries);
    }
    return removed;
  }

  validateSurfaceContribution(surface: PluginLayerSurfaceContribution): { valid: boolean; reason?: string } {
    const layer = this.layers.get(surface.layer);
    if (!layer) {
      return { valid: false, reason: `Layer '${surface.layer}' does not exist` };
    }
    if (!layer.pluginContributable) {
      return { valid: false, reason: `Layer '${surface.layer}' does not accept plugin contributions` };
    }
    if (surface.sessionLock && !layer.supportsSessionLock) {
      return { valid: false, reason: `Layer '${surface.layer}' does not support session lock` };
    }
    if (this.sessionLockCheck && !this.sessionLockCheck(layer.zOrder)) {
      return {
        valid: false,
        reason: `Session lock active — cannot add surface to layer '${surface.layer}' at z-order ${layer.zOrder}`,
      };
    }
    return { valid: true };
  }

  getOrderedLayers(): LayerDefinition[] {
    return [...this.layers.values()].sort((a, b) => a.zOrder - b.zOrder);
  }

  getLayer(name: string): LayerDefinition | undefined {
    return this.layers.get(name);
  }

  getSurfacesForLayer(layerName: string): Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }> {
    const result: Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }> = [];
    for (const entry of this.surfaces.values()) {
      if (entry.surface.layer === layerName) {
        result.push(entry);
      }
    }
    return result;
  }

  getAllSurfaces(): Array<{ surface: PluginLayerSurfaceContribution; pluginId: string }> {
    return [...this.surfaces.values()];
  }

  registerShellSurface(surface: ShellLayerSurface): { success: boolean; reason?: string } {
    const layer = this.layers.get(surface.layer);
    if (!layer) {
      return { success: false, reason: `Layer '${surface.layer}' does not exist` };
    }
    if (this.sessionLockCheck && !this.sessionLockCheck(layer.zOrder)) {
      return {
        success: false,
        reason: `Session lock active — cannot add shell surface to layer '${surface.layer}'`,
      };
    }
    this.shellSurfaces.set(surface.id, surface);
    return { success: true };
  }

  unregisterShellSurface(id: string): boolean {
    return this.shellSurfaces.delete(id);
  }

  getShellSurfacesForLayer(layerName: string): ShellLayerSurface[] {
    const result: ShellLayerSurface[] = [];
    for (const surface of this.shellSurfaces.values()) {
      if (surface.layer === layerName) {
        result.push(surface);
      }
    }
    return result;
  }

  getAllShellSurfaces(): ShellLayerSurface[] {
    return [...this.shellSurfaces.values()];
  }
}
