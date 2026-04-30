import type { PluginPartContribution } from "@ghost-shell/contracts";
import { composeEnabledPluginContributions } from "@ghost-shell/plugin-system";
import type { BridgeHost, PluginHost, ShellRuntime, StateHost } from "../app/types.js";
import { escapeHtml } from "../app/utils.js";
import type { DockNode } from "../context-state.js";
import { canReopenClosedTab, getTabCloseability } from "../context-state.js";
import { renderPartBody } from "./parts-rendering-body.js";
import { renderDockDropOverlay, renderDockPartPanel } from "./parts-rendering-dock-panel.js";
import { renderDockSplitTrackStyle } from "./parts-rendering-dock-split-style.js";

export interface ComposedShellPart {
  instanceId: string;
  definitionId: string;
  id: string;
  partDefinitionId: string;
  title: string;
  args: Record<string, string>;
  slot: "main" | "secondary" | "side";
  component?: string;
  pluginId: string;
}

export interface ComposedPartDefinition {
  definitionId: string;
  title: string;
  slot: "main" | "secondary" | "side";
  component?: string;
  pluginId: string;
}

export type PartSlot = ComposedShellPart["slot"];

export function composePartDefinitionsFromRegistrySnapshot(
  snapshot: ReturnType<PluginHost["registry"]["getSnapshot"]>,
): ComposedPartDefinition[] {
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      contract: plugin.contract,
    })),
  );

  const contractParts = composed.parts.map((part) => ({
    definitionId: part.id,
    title: part.title,
    slot: resolveSlotFromDockContainer(readDockContainer(part)),
    component: part.component,
    pluginId: part.pluginId,
  }));

  // Eager discovery: include parts from unloaded plugin descriptors
  const loadedPluginIds = new Set(
    snapshot.plugins.filter((p) => p.enabled && p.contract !== null).map((p) => p.id),
  );

  const descriptorParts = extractDescriptorParts(snapshot.plugins, loadedPluginIds);

  // Loaded contracts take precedence over descriptor-sourced parts
  const loadedPartIds = new Set(contractParts.map((p) => p.definitionId));
  const newParts = descriptorParts.filter((p) => !loadedPartIds.has(p.definitionId));

  return [...contractParts, ...newParts];
}

function extractDescriptorParts(
  plugins: ReturnType<PluginHost["registry"]["getSnapshot"]>["plugins"],
  loadedPluginIds: Set<string>,
): ComposedPartDefinition[] {
  return plugins
    .filter(
      (plugin) =>
        plugin.enabled && plugin.contract === null && !loadedPluginIds.has(plugin.id) &&
        plugin.descriptor.contributes?.parts,
    )
    .flatMap((plugin) => {
      const parts = plugin.descriptor.contributes?.parts;
      if (!parts) return [];
      return parts.map((part: PluginPartContribution) => ({
        definitionId: part.id,
        title: part.title,
        slot: resolveSlotFromDockContainer(readDockContainer(part)),
        component: part.component,
        pluginId: plugin.id,
      }));
    });
}

function readDockContainer(part: unknown): string | undefined {
  if (!part || typeof part !== "object" || !("dock" in part)) {
    return undefined;
  }

  const dock = part.dock;
  if (!dock || typeof dock !== "object" || !("container" in dock)) {
    return undefined;
  }

  return typeof dock.container === "string" ? dock.container : undefined;
}

function resolveSlotFromDockContainer(container: string | undefined): PartSlot {
  if (container === "side") {
    return "side";
  }

  if (container === "secondary") {
    return "secondary";
  }

  return "main";
}

export function getVisiblePartDefinitions(runtime: PluginHost): ComposedPartDefinition[] {
  return composePartDefinitionsFromRegistrySnapshot(runtime.registry.getSnapshot());
}

export function getVisibleComposedParts(runtime: PluginHost & StateHost): ComposedShellPart[] {
  const definitionsById = new Map(
    getVisiblePartDefinitions(runtime).map((definition) => [definition.definitionId, definition]),
  );

  const pluginParts = runtime.contextState.tabOrder
    .map((tabId) => runtime.contextState.tabs[tabId])
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
    .map((tab) => {
      const tabDefinitionId = tab.partDefinitionId ?? tab.definitionId;
      const definition = definitionsById.get(tabDefinitionId);
      if (!definition) {
        return null;
      }

      return {
        instanceId: tab.id,
        definitionId: definition.definitionId,
        id: tab.id,
        partDefinitionId: definition.definitionId,
        title: tab.label,
        args: tab.args,
        slot: definition.slot,
        component: definition.component,
        pluginId: definition.pluginId,
      } satisfies ComposedShellPart;
    })
    .filter((part) => part !== null);

  return pluginParts;
}

export function renderPartCard(
  part: ComposedShellPart,
  runtime: StateHost & BridgeHost,
  options: { showPopoutButton: boolean; showRestoreButton?: boolean },
): string {
  const closeability = getTabCloseability(runtime.contextState, part.instanceId);
  const closeabilityAttrs = [
    `data-tab-close-policy="${closeability.policy}"`,
    `data-tab-close-action-availability="${closeability.actionAvailability}"`,
    `data-tab-can-close="${closeability.canClose ? "true" : "false"}"`,
    `data-tab-close-disabled-reason="${closeability.reason ?? "none"}"`,
  ].join(" ");

  const popoutButton = options.showPopoutButton
    ? `<button type="button" data-action="popout" data-tab-id="${part.instanceId}" data-part-id="${part.instanceId}" aria-label="Pop out ${escapeHtml(part.title)} to a new window" title="Pop out tab to a new window">Pop out tab</button>`
    : "";
  const restoreButton = options.showRestoreButton
    ? `<button type="button" data-action="restore" data-tab-id="${part.instanceId}" data-part-id="${part.instanceId}" aria-label="Restore ${escapeHtml(part.title)} to the host window" title="Restore tab to host window">Restore tab</button>`
    : "";

  return `
    <article class="part-root" data-tab-id="${part.instanceId}" data-definition-id="${part.definitionId}" data-part-id="${part.instanceId}" draggable="true" ${closeabilityAttrs}>
      <h2>${escapeHtml(part.title)}</h2>
      <div class="part-actions">
        ${popoutButton}
        ${restoreButton}
      </div>
      ${renderPartBody(part)}
      <div class="dropzone" data-dropzone-for="${part.instanceId}">Drop cross-window payload here</div>
      <p class="runtime-note" data-drop-result-for="${part.instanceId}"></p>
      <p class="runtime-note">Window: ${runtime.windowId}</p>
    </article>
  `;
}

export function updateSelectedStyles(root: HTMLElement, selectedPartId: string | null): void {
  for (const stack of root.querySelectorAll<HTMLElement>(".dock-node-stack")) {
    stack.classList.remove("is-active-stack");
  }

  for (const node of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    const partId = node.dataset.partId;
    if (partId && partId === selectedPartId) {
      node.classList.add("is-selected");
    } else {
      node.classList.remove("is-selected");
    }
  }

  if (selectedPartId) {
    const activeContent = root.querySelector<HTMLElement>(`.dock-tabpanel-content[data-part-id="${selectedPartId}"]`);
    activeContent?.closest(".dock-node-stack")?.classList.add("is-active-stack");
  }
}

export function resolvePartTitle(partId: string, runtime: PluginHost & StateHost): string {
  return getVisibleComposedParts(runtime).find((part) => part.instanceId === partId)?.title ?? partId;
}

export function renderTabStrip(
  slot: PartSlot,
  tabs: ComposedShellPart[],
  activeTabId: string,
  runtime: BridgeHost & StateHost,
  options?: {
    tabScope?: string;
    label?: string;
  },
): string {
  const label = options?.label ?? `${slot} panel tabs`;
  const tabScope = options?.tabScope ?? `slot:${slot}`;
  const reopenEnabled = !runtime.syncDegraded && canReopenClosedTab(runtime.contextState, slot);
  const reopenAriaLabel = reopenEnabled
    ? "Reopen most recently closed tab in this panel"
    : "Reopen unavailable: no recently closed tab in this panel or sync is degraded";
  const reopenTitle = reopenEnabled
    ? "Reopen closed tab (Ctrl+Shift+T / ⌘⇧T)"
    : "Reopen unavailable: no recently closed tab in this panel or sync is degraded";
  return `
    <div class="part-tab-strip" role="tablist" aria-label="${escapeHtml(label)}" data-slot-tablist="${slot}" data-tab-scope="${escapeHtml(tabScope)}">
      ${tabs
        .map((part) => {
          const isActive = part.instanceId === activeTabId;
          const closeability = getTabCloseability(runtime.contextState, part.instanceId);
          const closeButton = closeability.canClose
            ? `<button
            type="button"
            class="part-tab-close"
            data-action="close-tab"
            data-tab-id="${part.instanceId}"
            aria-label="Close ${escapeHtml(part.title)} tab (Ctrl+W / ⌘W)"
            aria-keyshortcuts="Control+W Meta+W"
            title="Close tab (Ctrl+W / ⌘W)"
          >×</button>`
            : "";
          return `<div class="part-tab-item" data-tab-item="${part.instanceId}" data-tab-can-close="${closeability.canClose ? "true" : "false"}" data-part-id="${part.instanceId}">
        <button
          type="button"
          role="tab"
          class="part-tab${isActive ? " is-active" : ""}"
          id="tab-${part.instanceId}"
          data-action="activate-tab"
          data-slot="${part.slot}"
          data-tab-scope="${escapeHtml(tabScope)}"
          data-tab-id="${part.instanceId}"
          data-part-id="${part.instanceId}"
          data-part-definition-id="${part.definitionId}"
          data-part-title="${escapeHtml(part.title)}"
          aria-selected="${isActive ? "true" : "false"}"
          aria-controls="panel-${part.instanceId}"
          tabindex="${isActive ? "0" : "-1"}"
          aria-label="${escapeHtml(part.title)} tab"
          title="${escapeHtml(part.title)} tab — drag to rearrange"
        >${escapeHtml(part.title)}</button>
        ${closeButton}
      </div>`;
        })
        .join("")}
      <button
        type="button"
        class="part-tab"
        data-action="reopen-closed-tab"
        data-slot="${slot}"
        data-tab-scope="${escapeHtml(tabScope)}"
        aria-label="${reopenAriaLabel}"
        aria-keyshortcuts="Control+Shift+T Meta+Shift+T"
        title="${reopenTitle}"
        ${reopenEnabled ? "" : 'disabled aria-disabled="true"'}
      >↶ Reopen</button>
    </div>
  `;
}

export function isPartActivationNode(target: HTMLElement): target is HTMLButtonElement {
  const action = target.dataset.action;
  return target instanceof HTMLButtonElement && action === "activate-tab";
}

export function renderDockTree(
  root: DockNode | null,
  visibleParts: ComposedShellPart[],
  runtime: ShellRuntime,
): string {
  const partsById = new Map(visibleParts.map((part) => [part.id, part]));
  const activeTabId =
    runtime.selectedPartId && partsById.has(runtime.selectedPartId)
      ? runtime.selectedPartId
      : runtime.contextState.activeTabId && partsById.has(runtime.contextState.activeTabId)
        ? runtime.contextState.activeTabId
        : visibleParts[0]?.id;
  return renderDockNode(root, partsById, activeTabId ?? null, runtime);
}

function renderDockNode(
  node: DockNode | null,
  partsById: Map<string, ComposedShellPart>,
  fallbackActiveTabId: string | null,
  runtime: BridgeHost & StateHost,
): string {
  if (!node) {
    return "";
  }

  if (node.kind === "split") {
    const first = renderDockNode(node.first, partsById, fallbackActiveTabId, runtime);
    const second = renderDockNode(node.second, partsById, fallbackActiveTabId, runtime);
    if (!first && !second) {
      return "";
    }
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }

    return `<section class="dock-node dock-node-split dock-node-split-${node.orientation}"${renderDockSplitTrackStyle(node)} data-dock-node-id="${node.id}" data-dock-orientation="${node.orientation}">
      <section class="dock-split-branch" data-dock-branch="first">${first}</section>
      <div
        class="dock-splitter dock-splitter-${node.orientation}"
        role="separator"
        aria-orientation="${node.orientation === "horizontal" ? "vertical" : "horizontal"}"
        aria-label="Resize split"
        data-dock-splitter="true"
        data-dock-split-id="${node.id}"
        data-dock-orientation="${node.orientation}"
      ></div>
      <section class="dock-split-branch" data-dock-branch="second">${second}</section>
    </section>`;
  }

  const tabs = node.tabIds
    .map((tabId) => partsById.get(tabId))
    .filter((part): part is ComposedShellPart => Boolean(part));
  if (tabs.length === 0) {
    return "";
  }

  const activeTabId = resolveStackActiveTabId(node.activeTabId, fallbackActiveTabId, tabs);
  const panelSlot = tabs[0]?.slot ?? "main";
  const tabScope = `stack:${node.id}`;
  const panelLabel = `${tabs[0]?.title ?? panelSlot} panel tabs`;
  const isSingleTab = tabs.length === 1;
  return `<section class="dock-node dock-node-stack" data-dock-node-id="${node.id}" data-dock-stack-id="${node.id}" data-slot="${panelSlot}"${isSingleTab ? ' data-single-tab="true"' : ""}>
      ${renderTabStrip(panelSlot, tabs, activeTabId, runtime, { tabScope, label: panelLabel })}
      <section class="dock-stack-panels" data-dock-stack-panels="${node.id}">
        ${tabs.map((part) => renderDockPartPanel(part, part.id === activeTabId)).join("")}
        ${renderDockDropOverlay(activeTabId)}
      </section>
    </section>`;
}

function resolveStackActiveTabId(
  nodeActiveTabId: string | null,
  fallbackActiveTabId: string | null,
  tabs: ComposedShellPart[],
): string {
  if (nodeActiveTabId && tabs.some((part) => part.id === nodeActiveTabId)) {
    return nodeActiveTabId;
  }

  if (fallbackActiveTabId && tabs.some((part) => part.id === fallbackActiveTabId)) {
    return fallbackActiveTabId;
  }

  if (tabs.length === 0) {
    return "";
  }

  return tabs[0]?.id;
}
