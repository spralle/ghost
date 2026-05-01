import type { ShellStateObserver } from "@ghost-shell/router";
import type { PlacementConfig, PlacementStrategyRegistry } from "@ghost-shell/state";
import type { ShellPartHostAdapter } from "../contracts.js";
import type { DndDiagnosticEnvelope, DndDiagnosticRuntime } from "../dnd-diagnostics.js";
import type { ScompPeer } from "../../scomp-runtime.js";
import type {
  ActionHost,
  BridgeHost,
  DndHost,
  IntentHost,
  LayoutHost,
  PersistenceHost,
  PluginHost,
  PopoutHost,
  StateHost,
  ThemeHost,
} from "./host-interfaces.js";

// ---------------------------------------------------------------------------
// ShellRuntime — the full god-object, composed from all capability interfaces.
// Composition root and top-level wiring keep this type; leaf consumers should
// migrate to the narrowest host interface(s) they need (armada-mi6h).
// ---------------------------------------------------------------------------

export interface ShellRuntime
  extends DndDiagnosticRuntime,
    LayoutHost,
    StateHost,
    BridgeHost,
    PluginHost,
    ThemeHost,
    ActionHost,
    IntentHost,
    DndHost,
    PersistenceHost,
    PopoutHost {
  selectedPartId: string | null;
  selectedPartTitle: string | null;
  notice: string;
  pluginNotice: string;
  intentNotice: string;
  closeableTabIds: Set<string>;
  announcement: string;
  pendingFocusSelector: string | null;
  workspaceEvents: {
    fireDidChangeWorkspaces(): void;
    readonly onDidChangeWorkspaces: import("@ghost-shell/contracts").Event<void>;
  };
  actionNotice: string;
  partHost: ShellPartHostAdapter;
  pluginConfigSyncDispose: (() => void) | null;
  registrySubscriptionDispose: (() => void) | null;
  lastDndDiagnostic: DndDiagnosticEnvelope | null;
  placementRegistry: PlacementStrategyRegistry;
  placementConfig: PlacementConfig;
  elevatedSession: {
    active: boolean;
    activatedAt: number | null;
  };
  stateObserver?: ShellStateObserver | undefined;
  /** Scomp peer for cross-window contract resolution (injected at boot). */
  scomp?: ScompPeer | undefined;
}
