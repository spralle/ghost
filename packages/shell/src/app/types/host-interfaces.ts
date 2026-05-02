import type {
  AsyncWindowBridge,
  AsyncWindowBridgeRejectReason,
  createDragSessionBroker,
  WindowBridge,
} from "@ghost-shell/bridge";
import type { KeybindingOverrideManager } from "@ghost-shell/commands";
import type { PluginServices } from "@ghost-shell/contracts";
import type { IntentActionMatch, IntentResolutionTrace, IntentRuntime, IntentSession } from "@ghost-shell/intents";
import type { WorkspaceManagerState } from "@ghost-shell/state";
import type { ActionSurface } from "../../action-surface.js";
import type { IncomingTransferJournal, ShellContextState } from "../../context-state.js";
import type { ShellLayoutState } from "../../layout.js";
import type {
  ShellContextStatePersistence,
  ShellKeybindingPersistence,
  ShellLayoutPersistence,
  ShellWorkspacePersistence,
} from "../../persistence.js";
import type { ShellPluginRegistry } from "../../plugin-registry.js";
import type { ThemeRegistry } from "../../theme-registry.js";
import type { DndDiagnosticPath } from "../dnd-diagnostics.js";
import type { ShellTransportPath } from "../migration-flags.js";
import type { SourceTabTransferPendingState } from "./dnd-types.js";

export interface LayoutHost {
  layout: ShellLayoutState;
}

export interface StateHost {
  contextState: ShellContextState;
  workspaceManager: WorkspaceManagerState;
}

export interface BridgeHost {
  bridge: WindowBridge;
  asyncBridge: AsyncWindowBridge;
  windowId: string;
  syncDegraded: boolean;
  syncHealthState: "healthy" | "degraded" | "unavailable";
  syncDegradedReason: AsyncWindowBridgeRejectReason | null;
  pendingProbeId: string | null;
  activeTransportPath: ShellTransportPath;
  activeTransportReason: "kill-switch-force-legacy" | "async-flag-enabled" | "default-legacy";
}

export interface PluginHost {
  registry: ShellPluginRegistry;
  services: PluginServices;
  /** Shared registry of runtime action handlers registered by plugins via ActionService. */
  runtimeActionRegistry: Map<string, (...args: unknown[]) => unknown>;
}

export interface ThemeHost {
  themeRegistry: ThemeRegistry | null;
}

export interface ActionHost {
  actionSurface: ActionSurface;
  keybindingOverrideManager: KeybindingOverrideManager;
}

export interface IntentHost {
  intentRuntime: IntentRuntime;
  activeIntentSession: IntentSession | null;
  lastIntentTrace: IntentResolutionTrace | null;
  /** Resolver for the async chooser promise bridge. Set by showChooser delegate, consumed by UI handlers. */
  _pendingChooserResolve: ((match: IntentActionMatch | null) => void) | null;
}

export interface DndHost {
  dragSessionBroker: ReturnType<typeof createDragSessionBroker>;
  incomingTransferJournal: IncomingTransferJournal;
  sourceTabTransferPendingBySessionId?: Map<string, SourceTabTransferPendingState>;
  sourceTabTransferTerminalSessionIds?: Set<string>;
  crossWindowDndEnabled: boolean;
  crossWindowDndKillSwitchActive: boolean;
  activeDndPath: DndDiagnosticPath;
  activeDndReason: "kill-switch-force-disabled" | "flag-enabled" | "default-same-window-only";
}

export interface PersistenceHost {
  persistence: ShellLayoutPersistence;
  contextPersistence: ShellContextStatePersistence;
  keybindingPersistence: ShellKeybindingPersistence;
  workspacePersistence: ShellWorkspacePersistence;
}

export interface PopoutHost {
  hostWindowId: string | null;
  popoutTabId: string | null;
  isPopout: boolean;
  popoutHandles: Map<string, Window>;
  poppedOutTabIds: Set<string>;
  popoutManifestRegistry?: import("../../popout-manifest-registry.js").PopoutManifestRegistry | undefined;
}
