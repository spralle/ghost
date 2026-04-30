import {
  createAsyncScompWindowBridge,
  createAsyncWindowBridgeCompatibilityShim,
  createDragSessionBroker,
  createWindowBridge,
} from "@ghost-shell/bridge";
import { createKeybindingOverrideManager } from "@ghost-shell/commands";
import { createIntentRuntime } from "@ghost-shell/intents";
import { createEventEmitter } from "@ghost-shell/plugin-system";
import { initPlacementStrategy } from "@ghost-shell/state";
import { buildActionSurface } from "../action-surface.js";
import { createIncomingTransferJournal, createInitialShellContextState } from "../context-state.js";
import { createDefaultLayoutState } from "../layout.js";
import { createShellPartHostAdapter } from "../part-module-host.js";
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageKeybindingPersistence,
  createLocalStorageLayoutPersistence,
  createLocalStorageWorkspacePersistence,
} from "../persistence.js";
import { createShellPluginRegistry } from "../plugin-registry.js";
import { createPluginServicesBridge } from "../plugin-service-bridge.js";
import {
  createDefaultShellKeybindingContract,
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
  DEFAULT_SHELL_KEYBINDINGS,
} from "../shell-runtime/default-shell-keybindings.js";
import { BRIDGE_CHANNEL, DEFAULT_GROUP_COLOR, DEFAULT_GROUP_ID } from "./constants.js";
import { readShellMigrationFlags, type ShellTransportPath, selectCrossWindowDnd } from "./migration-flags.js";
import type { ShellRuntime, SourceTabTransferPendingState } from "./types.js";
import { createWindowId, getCurrentUserId, getStorage, readPopoutParams } from "./utils.js";

export function createShellRuntime(options?: { transportPath?: ShellTransportPath; windowId?: string }): ShellRuntime {
  const migrationFlags = readShellMigrationFlags();
  const crossWindowDnd = selectCrossWindowDnd(migrationFlags);
  const popoutParams = readPopoutParams();
  const windowId = options?.windowId ?? createWindowId();
  const bridge = createWindowBridge(BRIDGE_CHANNEL);
  const asyncBridge =
    options?.transportPath === "async-scomp-adapter"
      ? createAsyncScompWindowBridge({
          channelName: BRIDGE_CHANNEL,
        })
      : createAsyncWindowBridgeCompatibilityShim(bridge);

  const intentRuntime = createIntentRuntime({
    getRegistrySnapshot: () => registry.getSnapshot(),
  });
  const registry = createShellPluginRegistry();

  const { registry: placementRegistry, config: placementConfig } = initPlacementStrategy();
  const workspaceChangeEmitter = createEventEmitter<void>();

  const runtime: ShellRuntime = {
    layout: createDefaultLayoutState(),
    persistence: createLocalStorageLayoutPersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    contextPersistence: createLocalStorageContextStatePersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    keybindingPersistence: createLocalStorageKeybindingPersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    workspacePersistence: createLocalStorageWorkspacePersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    registry,
    services: createPluginServicesBridge(registry),
    bridge,
    asyncBridge,
    windowId,
    hostWindowId: popoutParams.hostWindowId,
    popoutTabId: popoutParams.tabId,
    isPopout: popoutParams.isPopout,
    selectedPartId: null,
    selectedPartTitle: null,
    contextState: createInitialShellContextState({
      initialTabId: popoutParams.isPopout && popoutParams.tabId ? popoutParams.tabId : "tab-main",
      initialGroupId: DEFAULT_GROUP_ID,
      initialGroupColor: DEFAULT_GROUP_COLOR,
    }),
    notice: "",
    pluginNotice: "",
    intentNotice: "",
    activeIntentSession: null,
    lastIntentTrace: null,
    _pendingChooserResolve: null,
    popoutHandles: new Map<string, Window>(),
    poppedOutTabIds: new Set<string>(),
    closeableTabIds: new Set<string>(),
    dragSessionBroker: createDragSessionBroker(bridge, windowId, {
      isDegraded: () => runtime.syncDegraded,
    }),
    incomingTransferJournal: createIncomingTransferJournal(),
    sourceTabTransferPendingBySessionId: new Map<string, SourceTabTransferPendingState>(),
    sourceTabTransferTerminalSessionIds: new Set<string>(),
    crossWindowDndEnabled: crossWindowDnd.enabled,
    crossWindowDndKillSwitchActive: migrationFlags.forceDisableCrossWindowDnd,
    syncDegraded: !bridge.available,
    syncHealthState: bridge.available ? "healthy" : "unavailable",
    syncDegradedReason: bridge.available ? null : "unavailable",
    pendingProbeId: null,
    announcement: "",
    pendingFocusSelector: null,
    actionSurface: buildActionSurface([createDefaultShellKeybindingContract()]),
    // SAFETY: Deferred init — assigned immediately after object creation (line ~150),
    // before a consumer can access the runtime. The cast avoids making 30+ consumer
    // sites handle a null that is never observable in practice.
    keybindingOverrideManager: null as unknown as ShellRuntime["keybindingOverrideManager"],
    themeRegistry: null,
    intentRuntime,
    runtimeActionRegistry: new Map(),
    workspaceEvents: {
      fireDidChangeWorkspaces: () => {
        workspaceChangeEmitter.fire(undefined);
      },
      onDidChangeWorkspaces: workspaceChangeEmitter.event,
    },
    actionNotice: "",
    // SAFETY: Deferred init — assigned immediately after object creation (line ~149),
    // before consumers can access the runtime.
    partHost: null as unknown as ReturnType<typeof createShellPartHostAdapter>,
    pluginConfigSyncDispose: null,
    registrySubscriptionDispose: null,
    activeTransportPath: "legacy-bridge",
    activeTransportReason: "default-legacy",
    activeDndPath: crossWindowDnd.path,
    activeDndReason: crossWindowDnd.reason,
    lastDndDiagnostic: null,
    // SAFETY: Deferred init — assigned immediately after object creation (line ~167),
    // before consumers can access the runtime.
    workspaceManager: null as unknown as ShellRuntime["workspaceManager"],
    placementRegistry,
    placementConfig,
    elevatedSession: {
      active: false,
      activatedAt: null,
    },
  };

  // Popout tab needs the correct definitionId (strip instance suffix ~N)
  if (popoutParams.isPopout && popoutParams.tabId) {
    const tab = runtime.contextState.tabs[popoutParams.tabId];
    if (tab) {
      const definitionId = popoutParams.tabId.replace(/~\d+$/, "");
      tab.definitionId = definitionId;
      tab.partDefinitionId = definitionId;
    }
  }

  runtime.partHost = createShellPartHostAdapter(runtime);
  runtime.keybindingOverrideManager = createKeybindingOverrideManager({
    persistence: runtime.keybindingPersistence,
    getDefaultBindings: () =>
      DEFAULT_SHELL_KEYBINDINGS.map((entry) => ({
        action: entry.action,
        keybinding: entry.keybinding,
        pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      })),
    getPluginBindings: () =>
      runtime.actionSurface.keybindings.filter((b) => b.pluginId !== DEFAULT_SHELL_KEYBINDING_PLUGIN_ID),
  });

  runtime.registry.registerManifestDescriptors("local", []);
  runtime.registry.registerBuiltinPlugin(createDefaultShellKeybindingContract());
  // topbar-widgets contract is now provided by the MF plugin (topbar-widgets-plugin)
  runtime.layout = runtime.persistence.load();
  const workspaceLoad = runtime.workspacePersistence.load(runtime.contextState);
  runtime.workspaceManager = workspaceLoad.state;
  runtime.contextState = runtime.workspaceManager.workspaces[runtime.workspaceManager.activeWorkspaceId].contextState;
  if (workspaceLoad.warning) {
    runtime.notice = workspaceLoad.warning;
  }

  return runtime;
}
