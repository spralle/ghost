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
import { createPluginRouterServiceApi } from "./plugin-api/plugin-router-service-api.js";
import { initializeShellRouter, type ShellRouterHandle } from "./router-initialization.js";
import { createPopoutManifestHost } from "./popout-manifest-host.js";
import { POPOUT_MANIFEST_CONTRACT_ID } from "./popout-manifest.js";
import { createPopoutManifestRegistry } from "./popout-manifest-registry.js";
import { bootPopoutWindow } from "./popout-boot.js";
import { createPopoutPluginLoader, createPopoutPartMounter } from "./popout-boot-wiring.js";
import type { ServiceGatewayTransport } from "./projected-plugin-services.js";
import { resolveWindowIdentity } from "./window-identity.js";
import { wirePopoutManifestContract } from "./popout-manifest-wiring.js";

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
  /** Scomp peer for cross-window contract resolution. Injected by app layer. */
  readonly scomp?: import("./scomp-runtime.js").ScompPeer;
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

  // Resolve unified window identity — this ID is used as both runtime.windowId
  // and scomp participantId, ensuring a single identity per window.
  const identity = resolveWindowIdentity();

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
    windowId: identity.windowId,
  });

  // Attach scomp peer if provided by app layer.
  if (options.scomp) {
    const scomp = options.scomp;
    runtime.scomp = scomp;

    // Wire popout manifest contract so popout windows can resolve their manifest.
    const wiring = wirePopoutManifestContract(
      scomp,
      () => scomp.participantId,
    );
    runtime.popoutManifestRegistry = wiring.registry;
  }

  // Re-wire partHost to use the shell's renderer registry (includes React renderer).
  // createShellRuntime creates a default partHost with vanilla-DOM-only renderer;
  // we replace it with one that shares the registry configured above.
  runtime.partHost = createShellPartHostAdapter(runtime, { rendererRegistry });

  let disposed = false;
  let disposeMount: (() => void) | null = null;
  let routerHandle: ShellRouterHandle | null = null;

  return {
    runtime,
    rendererRegistry,
    contextRegistry,

    async start(): Promise<void> {
      if (disposed) {
        throw new Error("Cannot start a disposed GhostShell instance.");
      }

      // Assert window identity unification: scomp participantId must match runtime.windowId.
      if (runtime.scomp && runtime.scomp.participantId !== runtime.windowId) {
        throw new Error(
          `Window identity mismatch: runtime.windowId="${runtime.windowId}" but scomp.participantId="${runtime.scomp.participantId}". ` +
            `The app layer must pass the same windowId to both createShellRuntime and scomp transport initialization.`,
        );
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

      // Initialize router after workspace state is ready
      routerHandle = initializeShellRouter(root, runtime);

      const routerService = createPluginRouterServiceApi({
        getShellRouter: () => routerHandle?.router ?? null,
      });

      // Plugin hydration (tenant manifest, config, themes)
      if (options.tenant) {
        await hydratePluginRegistry(root, runtime, () => !disposed, {
          tenantId: options.tenant.id,
          defaultThemeId: options.theme ?? "ghost.theme.tokyo-night",
          routerService,
        });
      }
      if (runtime.isPopout && options.popoutTransport) {
        const { initializePopout } = await import("./popout-initialization.js");
        const popoutInit = await initializePopout(options.popoutTransport, document);
        runtime.services = popoutInit.services;
        const originalDispose = disposeMount;
        disposeMount = () => {
          popoutInit.dispose();
          originalDispose?.();
        };
      }

      // Host-side: register manifest contract with scomp
      if (!runtime.isPopout && options.scomp) {
        const registry = createPopoutManifestRegistry();
        runtime.popoutManifestRegistry = registry;

        const manifestHost = createPopoutManifestHost({
          registry,
          getRequestingPeerId: () => options.scomp!.participantId,
        });

        options.scomp.register({
          contract: { id: POPOUT_MANIFEST_CONTRACT_ID },
          implementation: manifestHost,
        });
      }

      // Popout-side: manifest-driven boot sequence
      if (runtime.isPopout && options.scomp) {
        const federationRuntime = (await import("./federation-runtime.js")).createShellFederationRuntime();
        const serviceGatewayTransport: ServiceGatewayTransport = {
          callService: async () => ({ ok: true, value: undefined }),
          getStateSnapshot: async () => ({ snapshot: null }),
          subscribeOps: () => () => {},
        };

        const bootResult = await bootPopoutWindow({
          identity: { windowId: identity.windowId, isSecondary: true, hostWindowId: identity.hostWindowId },
          scompPeer: options.scomp,
          loadPlugin: createPopoutPluginLoader({
            federationRuntime,
            scompPeer: options.scomp,
            serviceGatewayTransport,
          }),
          mountPart: createPopoutPartMounter({}),
        });

        if (bootResult.errors.length > 0) {
          console.warn("[ghost] popout boot errors:", bootResult.errors);
        }
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      routerHandle?.dispose();
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
