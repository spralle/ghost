import { buildGroupContextSyncEvent } from "@ghost-shell/bridge";
import type { BridgeHost, ShellRuntime } from "../app/types.js";
import {
  CORE_GROUP_CONTEXT_KEY,
  createRevision,
  ensureTabsRegistered,
  reconcileActiveTab,
  updateContextState,
  writeGroupSelectionContext,
} from "../context/runtime-state.js";
import { getTabGroupId } from "../context-state.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";
import { updateWindowReadOnlyState } from "../ui/context-controls.js";
import { renderParts as renderPartsView } from "../ui/parts-controller.js";
import { getVisibleComposedParts, getVisiblePartDefinitions } from "../ui/parts-rendering.js";
import { createReactPanelsHost } from "../ui/react/panels-host.js";
import { deriveCloseableTabIds } from "./runtime-render-transition.js";

type ReactPanelsHost = ReturnType<typeof createReactPanelsHost>;

const panelsByRuntime = new WeakMap<ShellRuntime, ReactPanelsHost>();

export interface RuntimeRenderBindings {
  activatePluginForBoundary: (options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  }) => Promise<boolean>;
  applySelection: (event: import("@ghost-shell/bridge").SelectionSyncEvent) => void;
  dismissIntentChooser: () => void;
  executeResolvedAction: (
    match: import("@ghost-shell/intents").IntentActionMatch,
    intent: import("@ghost-shell/intents").ShellIntent | null,
  ) => Promise<void>;
  primeEnabledPluginActivations: () => Promise<void>;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  refreshActionContributions: () => void;
  renderContextControlsPanel: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
}

export function initializeReactPanels(root: HTMLElement, runtime: ShellRuntime, bindings: RuntimeRenderBindings): void {
  const host = createReactPanelsHost(root, runtime, {
    onApplyContextValue: (value) => {
      if (runtime.syncDegraded) {
        return;
      }

      const activeTabId = reconcileActiveTab(runtime);
      if (!activeTabId) {
        return;
      }

      writeGroupSelectionContext(runtime, value);
      const groupId = getTabGroupId(runtime.contextState, activeTabId) ?? undefined;
      bindings.publishWithDegrade(
        buildGroupContextSyncEvent({
          tabId: activeTabId,
          groupId,
          contextKey: CORE_GROUP_CONTEXT_KEY,
          contextValue: value,
          revision: createRevision(runtime.windowId),
          sourceWindowId: runtime.windowId,
        }),
      );
      bindings.renderSyncStatus();
    },
    onChooseIntentAction: async (index) => {
      if (!runtime.activeIntentSession) {
        return;
      }
      runtime.activeIntentSession.chooserFocusIndex = index;
      const selectedMatch = runtime.activeIntentSession.matches[index];
      if (!selectedMatch) {
        return;
      }
      if (runtime._pendingChooserResolve) {
        runtime._pendingChooserResolve(selectedMatch);
      } else {
        await bindings.executeResolvedAction(selectedMatch, runtime.activeIntentSession.intent);
      }
    },
    onDismissChooser: () => {
      bindings.dismissIntentChooser();
    },
    onPendingFocusApplied: () => {
      runtime.pendingFocusSelector = null;
    },
  });

  panelsByRuntime.set(runtime, host);
  bindings.refreshActionContributions();
  renderPanels(root, runtime);
}

export function renderPanels(root: HTMLElement, runtime: ShellRuntime): void {
  const host = panelsByRuntime.get(runtime);
  if (!host) {
    return;
  }

  host.render();
  updateWindowReadOnlyState(root, runtime);
}

function seedTabsFromPartDefinitions(runtime: ShellRuntime): void {
  const definitions = getVisiblePartDefinitions(runtime);
  if (definitions.length === 0) return;

  // Collect definition IDs that already have a tab
  const existingDefinitionIds = new Set<string>();
  for (const tabId of runtime.contextState.tabOrder) {
    const tab = runtime.contextState.tabs[tabId];
    if (tab) {
      existingDefinitionIds.add(tab.definitionId);
      if (tab.partDefinitionId) {
        existingDefinitionIds.add(tab.partDefinitionId);
      }
    }
  }

  // Collect definition IDs that were explicitly closed by the user
  const closedDefinitionIds = new Set<string>();
  for (const entry of runtime.contextState.closedTabHistory) {
    if (entry.definitionId) closedDefinitionIds.add(entry.definitionId);
    if (entry.partDefinitionId) {
      closedDefinitionIds.add(entry.partDefinitionId);
    }
  }

  // Seed tabs for definitions missing both an existing tab and a close history entry
  const newDefinitions = definitions.filter(
    (def) => !existingDefinitionIds.has(def.definitionId) && !closedDefinitionIds.has(def.definitionId),
  );
  if (newDefinitions.length === 0) return;

  const tabRefs = newDefinitions.map((def) => ({
    instanceId: def.definitionId,
    definitionId: def.definitionId,
    title: def.title,
  }));
  updateContextState(runtime, ensureTabsRegistered(runtime.contextState, tabRefs));
}

export function renderParts(root: HTMLElement, runtime: ShellRuntime, bindings: RuntimeRenderBindings): void {
  void bindings.primeEnabledPluginActivations();
  seedTabsFromPartDefinitions(runtime);
  const visibleParts = getVisibleComposedParts(runtime);
  runtime.closeableTabIds = deriveCloseableTabIds(visibleParts);
  updateContextState(runtime, ensureTabsRegistered(runtime.contextState, visibleParts));
  reconcileActiveTab(runtime);

  // On-demand activation: if the active tab's plugin isn't activated yet,
  // trigger activation. The registry subscription will re-render once loaded.
  const activeTabId = runtime.contextState.activeTabId;
  if (activeTabId) {
    const activePart = visibleParts.find((p) => p.instanceId === activeTabId || p.definitionId === activeTabId);
    if (activePart) {
      const snapshot = runtime.registry.getSnapshot();
      const pluginEntry = snapshot.plugins.find((p) => p.id === activePart.pluginId);
      if (pluginEntry && !pluginEntry.contract) {
        void bindings.activatePluginForBoundary({
          pluginId: activePart.pluginId,
          triggerType: "view",
          triggerId: activePart.definitionId,
        });
      }
    }
  }

  renderPartsView(root, runtime, {
    applySelection: (event) => bindings.applySelection(event),
    partHost: runtime.partHost,
    publishWithDegrade: (event) => {
      bindings.publishWithDegrade(event);
    },
    renderContextControls: () => bindings.renderContextControlsPanel(),
    renderParts: () => bindings.renderParts(),
    renderSyncStatus: () => bindings.renderSyncStatus(),
  });
  updateWindowReadOnlyState(root, runtime);
}

export function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

export function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

export function renderDevContextInspector(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}
