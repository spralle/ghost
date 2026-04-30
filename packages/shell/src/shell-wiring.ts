/**
 * Shell wiring context — caches binding objects that were previously
 * re-created on every call. Constructed once per (root, runtime) pair
 * and exposes the same operations as the old stand-alone factory functions.
 *
 * Stand-alone functions are preserved as thin delegates so that existing
 * call-sites continue to compile without changes.
 */

import type { WindowBridgeEvent } from "@ghost-shell/bridge";
import type { PluginContract } from "@ghost-shell/contracts";
import { buildActionSurface } from "./action-surface.js";
import type { ShellRuntime } from "./app/types.js";
import { createWindowId } from "./app/utils.js";
import { getShellBootstrap } from "./bootstrap-shell.js";
import type { PluginActivationTriggerType } from "./plugin-registry.js";
import {
  summarizeSelectionPriorities as summarizeSelectionPrioritiesImpl,
  toActionContext,
} from "./shell-runtime/action-context.js";
import {
  announce as announceImpl,
  bindBridgeSync as bindBridgeSyncHandlers,
  publishWithDegrade,
} from "./shell-runtime/bridge-sync-handlers.js";
import {
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
  DEFAULT_SHELL_KEYBINDINGS,
  USER_KEYBINDING_OVERRIDE_PLUGIN_ID,
} from "./shell-runtime/default-shell-keybindings.js";
import {
  bindKeyboardShortcuts as bindKeyboardHandlers,
  dismissIntentChooser as dismissIntentChooserState,
} from "./shell-runtime/keyboard-handlers.js";
import { createRuntimeEventHandlers } from "./shell-runtime/runtime-event-handlers.js";

// ---------------------------------------------------------------------------
// ShellWiringContext — cached binding container
// ---------------------------------------------------------------------------

export class ShellWiringContext {
  private _runtimeEventHandlerBindings: ReturnType<typeof createRuntimeEventHandlerBindings> | null = null;
  private _runtimeEventHandlers: ReturnType<typeof createRuntimeEventHandlers> | null = null;
  private _bridgeBindings: ReturnType<typeof createBridgeBindings> | null = null;

  constructor(
    readonly root: HTMLElement,
    readonly runtime: ShellRuntime,
  ) {}

  get runtimeEventHandlerBindings() {
    // biome-ignore lint/suspicious/noAssignInExpressions: lazy-init getter pattern
    return (this._runtimeEventHandlerBindings ??= createRuntimeEventHandlerBindings(this.root, this.runtime));
  }

  get runtimeEventHandlers() {
    // biome-ignore lint/suspicious/noAssignInExpressions: lazy-init getter pattern
    return (this._runtimeEventHandlers ??= createRuntimeEventHandlers(
      this.root,
      this.runtime,
      this.runtimeEventHandlerBindings,
    ));
  }

  get bridgeBindings() {
    // biome-ignore lint/suspicious/noAssignInExpressions: lazy-init getter pattern
    return (this._bridgeBindings ??= createBridgeBindingsFromHandlers(
      this.root,
      this.runtime,
      this.runtimeEventHandlers,
    ));
  }

  announce(message: string): void {
    announce(this.root, this.runtime, message);
  }

  renderParts(): void {
    renderParts(this.root, this.runtime);
  }

  renderSyncStatus(): void {
    renderSyncStatus(this.root, this.runtime);
  }

  renderContextControlsPanel(): void {
    renderContextControlsPanel(this.root, this.runtime);
  }

  dismissIntentChooser(): void {
    dismissIntentChooser(this.root, this.runtime);
  }

  bindBridgeSync(
    core: Pick<ReturnType<typeof createRuntimeEventHandlers>, "applyContext" | "applySelection">,
  ): () => void {
    return bindBridgeSync(this.root, this.runtime, core);
  }

  bindKeyboardShortcuts(): () => void {
    return bindKeyboardShortcuts(this.root, this.runtime);
  }

  createWorkspaceSwitchDeps(applySelectionOverride?: ReturnType<typeof createRuntimeEventHandlers>["applySelection"]) {
    return createWorkspaceSwitchDeps(this.root, this.runtime, applySelectionOverride);
  }

  async primeEnabledPluginActivations(): Promise<void> {
    return primeEnabledPluginActivations(this.root, this.runtime);
  }

  async activatePluginForBoundary(options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }): Promise<boolean> {
    return activatePluginForBoundary(this.root, this.runtime, options);
  }
}

// ---------------------------------------------------------------------------
// Stand-alone functions (preserved for backward compatibility)
// ---------------------------------------------------------------------------

export function announce(root: HTMLElement, runtime: ShellRuntime, message: string): void {
  announceImpl(root, runtime, message);
}

export function summarizeSelectionPriorities(runtime: ShellRuntime): string {
  return summarizeSelectionPrioritiesImpl(runtime);
}

export function refreshActionContributions(runtime: ShellRuntime): void {
  const snapshot = runtime.registry.getSnapshot();

  // Loaded plugins: use their full contract (richer, validated data)
  const loadedContracts = snapshot.plugins
    .filter((plugin) => plugin.enabled && plugin.contract !== null)
    .map((plugin) => plugin.contract)
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const loadedPluginIds = new Set(loadedContracts.map((c) => c.manifest.id));

  // Unloaded plugins with descriptor contributes: create synthetic contracts
  // so their actions/keybindings are visible in the action surface without
  // loading the plugin's JS bundle.
  const descriptorContracts: PluginContract[] = snapshot.plugins
    .filter(
      (plugin) =>
        plugin.enabled &&
        plugin.contract === null &&
        plugin.descriptor.contributes &&
        !loadedPluginIds.has(plugin.id),
    )
    .map((plugin) => ({
      manifest: { id: plugin.id, name: plugin.id, version: plugin.descriptor.version },
      contributes: plugin.descriptor.contributes,
    }));

  runtime.actionSurface = buildActionSurface([...loadedContracts, ...descriptorContracts]);
}

export function renderParts(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderParts(root, runtime);
}

export function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderSyncStatus(root, runtime);
}

export function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  getShellBootstrap(runtime).renderContextControlsPanel(root, runtime);
}

export function dismissIntentChooser(root: HTMLElement, runtime: ShellRuntime): void {
  dismissIntentChooserState(runtime, {
    announce: (message) => announce(root, runtime, message),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
  });
}

export function createBridgeBindings(root: HTMLElement, runtime: ShellRuntime) {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  return createBridgeBindingsFromHandlers(root, runtime, handlers);
}

export function createRuntimeEventHandlerBindings(root: HTMLElement, runtime: ShellRuntime) {
  return {
    activatePluginForBoundary: (options: {
      pluginId: string;
      triggerType: PluginActivationTriggerType;
      triggerId: string;
    }) => activatePluginForBoundary(root, runtime, options),
    announce: (message: string) => announce(root, runtime, message),
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}

export function bindBridgeSync(
  root: HTMLElement,
  runtime: ShellRuntime,
  core: Pick<ReturnType<typeof createRuntimeEventHandlers>, "applyContext" | "applySelection">,
): () => void {
  return bindBridgeSyncHandlers(root, runtime, {
    ...createBridgeBindings(root, runtime),
    applyContext: core.applyContext,
    applySelection: core.applySelection,
  });
}

export function bindKeyboardShortcuts(root: HTMLElement, runtime: ShellRuntime): () => void {
  const handlers = createRuntimeEventHandlers(root, runtime, createRuntimeEventHandlerBindings(root, runtime));
  return bindKeyboardHandlers(root, runtime, {
    activatePluginForBoundary: (options) => activatePluginForBoundary(root, runtime, options),
    applySelection: handlers.applySelection,
    announce: (message) => announce(root, runtime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, runtime),
    executeResolvedAction: handlers.executeResolvedAction,
    publishWithDegrade: (event) => {
      publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime));
    },
    renderContextControls: () => renderContextControlsPanel(root, runtime),
    renderEdgeSlots: () => getShellBootstrap(runtime).renderEdgeSlots(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    toActionContext: () => toActionContext(runtime),
    getDefaultKeybindings: () =>
      DEFAULT_SHELL_KEYBINDINGS.map((entry) => ({
        action: entry.action,
        keybinding: entry.keybinding,
        pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      })),
    getUserOverrideKeybindings: () =>
      runtime.keybindingPersistence.load().map((entry) => ({
        action: entry.action,
        keybinding: entry.keybinding,
        pluginId: USER_KEYBINDING_OVERRIDE_PLUGIN_ID,
      })),
    getWorkspaceSwitchDeps: () => createWorkspaceSwitchDeps(root, runtime, handlers.applySelection),
  });
}

export function createWorkspaceSwitchDeps(
  root: HTMLElement,
  runtime: ShellRuntime,
  applySelectionOverride?: ReturnType<typeof createRuntimeEventHandlers>["applySelection"],
) {
  const bridgeBindings = createBridgeBindings(root, runtime);
  return {
    root,
    runtime,
    partsDeps: {
      applySelection: applySelectionOverride ?? bridgeBindings.applySelection,
      partHost: runtime.partHost,
      publishWithDegrade: (event: WindowBridgeEvent) => {
        publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime));
      },
      renderContextControls: () => renderContextControlsPanel(root, runtime),
      renderParts: () => renderParts(root, runtime),
      renderSyncStatus: () => renderSyncStatus(root, runtime),
    },
  };
}

export async function primeEnabledPluginActivations(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  const snapshot = runtime.registry.getSnapshot();
  const activations = snapshot.plugins
    .filter(
      (plugin) =>
        plugin.enabled &&
        plugin.descriptor.activationEvents?.includes("onStartup") &&
        plugin.lifecycle.state !== "active" &&
        plugin.lifecycle.state !== "activating" &&
        plugin.lifecycle.state !== "failed",
    )
    .map((plugin) =>
      activatePluginForBoundary(root, runtime, {
        pluginId: plugin.id,
        triggerType: "view",
        triggerId: "shell.render",
      }),
    );

  if (activations.length === 0) {
    return;
  }

  await Promise.all(activations);
  refreshActionContributions(runtime);
  getShellBootstrap(runtime).renderPanels(root, runtime);
  renderParts(root, runtime);
}

export async function activatePluginForBoundary(
  root: HTMLElement,
  runtime: ShellRuntime,
  options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  },
): Promise<boolean> {
  try {
    const activated =
      options.triggerType === "action"
        ? await runtime.registry.activateByAction(options.pluginId, options.triggerId)
        : options.triggerType === "intent"
          ? await runtime.registry.activateByIntent(options.pluginId, options.triggerId)
          : await runtime.registry.activateByView(options.pluginId, options.triggerId);

    if (!activated) {
      runtime.notice = `Plugin '${options.pluginId}' is not active for ${options.triggerType}:${options.triggerId}.`;
      renderSyncStatus(root, runtime);
      return false;
    }

    runtime.notice = "";
    refreshActionContributions(runtime);
    getShellBootstrap(runtime).renderPanels(root, runtime);
    return true;
  } catch (error) {
    runtime.notice = `Plugin activation failed for '${options.pluginId}' (${options.triggerType}:${options.triggerId}).`;
    renderSyncStatus(root, runtime);
    console.error("[shell] plugin activation boundary failed", options, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function createBridgeBindingsFromHandlers(
  root: HTMLElement,
  runtime: ShellRuntime,
  handlers: ReturnType<typeof createRuntimeEventHandlers>,
) {
  return {
    announce: (message: string) => announce(root, runtime, message),
    applyContext: handlers.applyContext,
    applySelection: handlers.applySelection,
    createWindowId,
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}
