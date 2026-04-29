/**
 * createGhostShell() — composition API entry point for embedding the ghost shell.
 *
 * Thin facade over existing shell internals that wires subsystems and returns
 * a clean GhostShell handle. Consumers get sensible defaults (localStorage
 * persistence, vanilla DOM + React renderers, Module Federation plugin loading)
 * while retaining the ability to override individual subsystems.
 */

import type { ContextContributionRegistry, PartRenderer, PartRendererRegistry } from "@ghost-shell/contracts";
import { createContextContributionRegistry } from "@ghost-shell/plugin-system";
import { createReactPartRenderer } from "@ghost-shell/react";
import type { ShellMigrationFlags } from "./app/migration-flags.js";
import { readShellMigrationFlags, selectShellTransportPath } from "./app/migration-flags.js";
import { createShellRuntime } from "./app/runtime.js";
import type { ShellRuntime } from "./app/types.js";
import type { ShellBootstrapDeps } from "./bootstrap-shell.js";
import { createShellBootstrap, registerShellBootstrap } from "./bootstrap-shell.js";
import { createShellPartHostAdapter } from "./part-module-host.js";
import { createPartRendererRegistry } from "./part-renderer-registry.js";
import { hydratePluginRegistry } from "./shell-hydrate.js";
import { mountShell, registerRuntimeTeardown } from "./shell-mount.js";
import { publishWithDegrade } from "./shell-runtime/bridge-sync-handlers.js";
import { getShellHmrRegistry } from "./shell-runtime/hmr-window-registry.js";
import { registerWorkspaceRuntimeActions } from "./shell-runtime/workspace-runtime-actions.js";
import {
  activatePluginForBoundary,
  announce,
  createBridgeBindings,
  dismissIntentChooser,
  primeEnabledPluginActivations,
  refreshActionContributions,
  renderContextControlsPanel,
  renderParts,
  renderSyncStatus,
  ShellWiringContext,
  summarizeSelectionPriorities,
} from "./shell-wiring.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GhostShellOptions {
  /** DOM element to mount the shell into. */
  readonly root: HTMLElement;
  /** Additional renderers registered after the built-in React renderer. */
  readonly renderers?: readonly PartRenderer[];
  /** Migration flags override (default: read from localStorage). */
  readonly migrationFlags?: ShellMigrationFlags;
  /** Tenant info for plugin discovery. If omitted, skips plugin hydration. */
  readonly tenant?: { readonly id: string };
  /** Default theme ID (e.g. 'ghost.theme.tokyo-night'). */
  readonly theme?: string;
  /** Expose `window.__g` debug namespace. Default: false. */
  readonly debug?: boolean;
  /** Register with HMR window registry for Vite hot reload. Default: false. */
  readonly hmr?: boolean;
  /** Transport for popout windows — enables projected services and style sync. */
  readonly popoutTransport?: import("./popout-initialization.js").PopoutTransport;
}

// ---------------------------------------------------------------------------
// GhostShell handle
// ---------------------------------------------------------------------------

export interface GhostShell {
  readonly runtime: ShellRuntime;
  readonly rendererRegistry: PartRendererRegistry;
  readonly contextRegistry: ContextContributionRegistry;
  /** Start the shell — mount, register bootstrap, bind keyboard/bridge, prime plugins. */
  start(): Promise<void>;
  /** Dispose all resources. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Debug namespace type
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __g?: {
      runtime: ShellRuntime;
      services: ShellRuntime["services"];
      registry: ShellRuntime["registry"];
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGhostShell(options: GhostShellOptions): GhostShell {
  const { root, renderers = [], migrationFlags } = options;

  const flags = migrationFlags ?? readShellMigrationFlags();
  const transportDecision = selectShellTransportPath(flags);

  // Core registries
  const rendererRegistry = createPartRendererRegistry();
  const contextRegistry = createContextContributionRegistry();

  // Register React renderer (uses context contribution registry for providers)
  rendererRegistry.register(createReactPartRenderer(contextRegistry));

  // Register consumer-supplied renderers
  for (const renderer of renderers) {
    rendererRegistry.register(renderer);
  }

  // Shell runtime (owns persistence, bridge, plugin registry, etc.)
  const runtime = createShellRuntime({
    transportPath: transportDecision.path,
  });

  // Re-wire partHost to use the shell's renderer registry (includes React renderer).
  // createShellRuntime creates a default partHost with vanilla-DOM-only renderer;
  // we replace it with one that shares the registry configured above.
  runtime.partHost = createShellPartHostAdapter(runtime, { rendererRegistry });

  let disposed = false;
  let disposeMount: (() => void) | null = null;

  return {
    runtime,
    rendererRegistry,
    contextRegistry,

    async start(): Promise<void> {
      if (disposed) {
        throw new Error("Cannot start a disposed GhostShell instance.");
      }

      const ctx = new ShellWiringContext(root, runtime);
      const bootstrapDeps = buildBootstrapDeps(root, runtime);
      const bootstrap = createShellBootstrap(root, runtime, flags, bootstrapDeps);
      registerShellBootstrap(runtime, bootstrap);

      registerWorkspaceRuntimeActions(runtime, {
        getWorkspaceSwitchDeps: () => ctx.createWorkspaceSwitchDeps(),
      });

      runtime.activeTransportPath = bootstrap.transportPath;
      runtime.activeTransportReason = bootstrap.transportReason;

      bootstrap.initialize(root, runtime);

      // Mount shell (popout vs main window, bridge sync, keyboard shortcuts)
      const disposeShellMount = mountShell(root, runtime, bootstrap);

      // Register beforeunload teardown
      registerRuntimeTeardown(runtime);

      // Debug namespace
      if (options.debug) {
        exposeDebugNamespace(runtime);
      }

      // HMR window registry
      if (options.hmr) {
        registerHmr(root, runtime);
      }

      disposeMount = () => {
        disposeShellMount();
        cleanupHmr(root, runtime, options);
        cleanupDebug(runtime, options);
      };

      await ctx.primeEnabledPluginActivations();

      // Plugin hydration (tenant manifest, config, themes)
      if (options.tenant && !runtime.isPopout) {
        await hydratePluginRegistry(root, runtime, () => !disposed, {
          tenantId: options.tenant.id,
          defaultThemeId: options.theme ?? "ghost.theme.tokyo-night",
        });
      } else if (runtime.isPopout && options.popoutTransport) {
        const { initializePopout } = await import("./popout-initialization.js");
        const popoutInit = await initializePopout(options.popoutTransport, document);
        runtime.services = popoutInit.services;
        const originalDispose = disposeMount;
        disposeMount = () => {
          popoutInit.dispose();
          originalDispose?.();
        };
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      disposeMount?.();
      runtime.registrySubscriptionDispose?.();
      runtime.pluginConfigSyncDispose?.();
      runtime.dragSessionBroker.dispose();
      runtime.asyncBridge.close();
      runtime.bridge.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBootstrapDeps(root: HTMLElement, runtime: ShellRuntime): ShellBootstrapDeps {
  return {
    activatePluginForBoundary: (opts) => activatePluginForBoundary(root, runtime, opts),
    announce: (message) => announce(root, runtime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, runtime),
    primeEnabledPluginActivations: () => primeEnabledPluginActivations(root, runtime),
    publishWithDegrade: (event) => publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime)),
    refreshActionContributions: () => refreshActionContributions(runtime),
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}

function exposeDebugNamespace(runtime: ShellRuntime): void {
  window.__g = {
    runtime,
    get services() {
      return runtime.services;
    },
    get registry() {
      return runtime.registry;
    },
  };
  console.debug("[shell] __g namespace available — try: __g.runtime, __g.services, __g.registry");
}

function registerHmr(root: HTMLElement, runtime: ShellRuntime): void {
  const hmrRegistry = getShellHmrRegistry();
  hmrRegistry.windowIds.add(runtime.windowId);
  hmrRegistry.byRoot.set(root, { windowId: runtime.windowId, dispose: () => {} });
}

function cleanupHmr(root: HTMLElement, runtime: ShellRuntime, options: GhostShellOptions): void {
  if (!options.hmr) return;
  const hmrRegistry = getShellHmrRegistry();
  hmrRegistry.windowIds.delete(runtime.windowId);
  if (hmrRegistry.byRoot.get(root)?.windowId === runtime.windowId) {
    hmrRegistry.byRoot.delete(root);
  }
}

function cleanupDebug(runtime: ShellRuntime, options: GhostShellOptions): void {
  if (!options.debug) return;
  if (window.__g?.runtime === runtime) {
    delete window.__g;
  }
}
