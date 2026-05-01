// compact-dock-renderer.ts — Renders all dock tree tabs as a flat bottom bar with full-screen active content.

import type { DockNode } from "../context-state.js";
import type { ContextTab, DockStackNode } from "@ghost-shell/state";
import { escapeHtml } from "../app/utils.js";
import { injectCompactDockStyles } from "./compact-dock-styles.js";
import { renderPartBody } from "./parts-rendering-body.js";
import type { ComposedShellPart } from "./parts-rendering.js";
import { createCompactHeader, type CompactHeaderHandle } from "./compact-header.js";

// ---------------------------------------------------------------------------
// Tab collection
// ---------------------------------------------------------------------------

export interface CompactTabInfo {
  readonly tabId: string;
  readonly stackId: string;
}

/** Collect all tabs from all stacks in the dock tree (depth-first, left-to-right). */
export function collectAllTabs(node: DockNode): CompactTabInfo[] {
  if (node.kind === "stack") {
    return node.tabIds.map((id) => ({ tabId: id, stackId: node.id }));
  }
  return [...collectAllTabs(node.first), ...collectAllTabs(node.second)];
}

// ---------------------------------------------------------------------------
// Bottom bar rendering
// ---------------------------------------------------------------------------

function renderBottomBarHtml(
  tabs: CompactTabInfo[],
  tabMeta: ReadonlyMap<string, ContextTab>,
  activeTabId: string,
): string {
  const items = tabs.map(({ tabId }) => {
    const meta = tabMeta.get(tabId);
    const label = meta?.label ?? tabId;
    const isActive = tabId === activeTabId;
    return `<button
      type="button"
      class="ghost-compact-tab"
      data-compact-tab-id="${tabId}"
      ${isActive ? "data-active" : ""}
      aria-label="${escapeHtml(label)} tab"
      title="${escapeHtml(label)}"
    ><span class="ghost-compact-tab-label">${escapeHtml(label)}</span></button>`;
  });

  return `<nav class="ghost-compact-bottom-bar" role="tablist" aria-label="Compact tab bar">${items.join("")}</nav>`;
}

// ---------------------------------------------------------------------------
// Content area rendering
// ---------------------------------------------------------------------------

function renderContentAreaHtml(
  tabs: CompactTabInfo[],
  parts: ReadonlyMap<string, ComposedShellPart>,
  activeTabId: string,
): string {
  const panels = tabs.map(({ tabId }) => {
    const part = parts.get(tabId);
    if (!part) {
      return `<div class="part-root" data-tab-id="${tabId}" data-hidden></div>`;
    }
    const hidden = tabId !== activeTabId;
    return `<section
      class="part-root dock-tabpanel-content"
      data-tab-id="${tabId}"
      data-part-id="${part.instanceId}"
      data-definition-id="${part.definitionId}"
      ${hidden ? "data-hidden" : ""}
      role="tabpanel"
      aria-labelledby="compact-tab-${tabId}"
    >${renderPartBody(part)}</section>`;
  });

  return `<div class="ghost-compact-content">${panels.join("")}</div>`;
}

// ---------------------------------------------------------------------------
// Nav history helper
// ---------------------------------------------------------------------------

function canGoBack(tree: DockNode, activeTabId: string): boolean {
  const stack = findStackForTab(tree, activeTabId);
  return (stack?.navHistory?.back.length ?? 0) > 0;
}

function findStackForTab(node: DockNode, tabId: string): DockStackNode | null {
  if (node.kind === "stack") {
    return node.tabIds.includes(tabId) ? node : null;
  }
  return findStackForTab(node.first, tabId) ?? findStackForTab(node.second, tabId);
}

// ---------------------------------------------------------------------------
// Handle interface
// ---------------------------------------------------------------------------

export interface CompactDockHandle {
  update(
    dockTree: DockNode,
    tabs: ReadonlyMap<string, ContextTab>,
    activeTabId: string,
    parts?: ReadonlyMap<string, ComposedShellPart>,
  ): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderCompactDock(
  container: HTMLElement,
  dockTree: DockNode,
  tabs: ReadonlyMap<string, ContextTab>,
  activeTabId: string,
  onTabSelect: (tabId: string) => void,
  parts?: ReadonlyMap<string, ComposedShellPart>,
  onBack?: () => void,
  onOverflow?: () => void,
): CompactDockHandle {
  injectCompactDockStyles();

  const header = createCompactHeader({
    onBack: () => onBack?.(),
    onOverflow: () => onOverflow?.(),
  });

  function updateHeader(tree: DockNode, tabMeta: ReadonlyMap<string, ContextTab>, active: string): void {
    const meta = tabMeta.get(active);
    const title = meta?.label ?? active;
    header.update(title, canGoBack(tree, active));
  }

  function render(tree: DockNode, tabMeta: ReadonlyMap<string, ContextTab>, active: string, partsMap?: ReadonlyMap<string, ComposedShellPart>): void {
    const collected = collectAllTabs(tree);
    const effectiveParts = partsMap ?? new Map<string, ComposedShellPart>();

    // Preserve mounted plugin content across re-renders
    const preserved = new Map<string, HTMLElement>();
    for (const el of container.querySelectorAll<HTMLElement>("[data-part-content-for]")) {
      const partId = el.dataset.partContentFor;
      if (partId && el.childNodes.length > 0) {
        preserved.set(partId, el);
      }
    }

    container.innerHTML = `<div class="ghost-compact-layout">${renderContentAreaHtml(collected, effectiveParts, active)}${renderBottomBarHtml(collected, tabMeta, active)}</div>`;

    // Insert header at top of layout
    const layout = container.querySelector<HTMLElement>(".ghost-compact-layout");
    if (layout) {
      layout.prepend(header.element);
    }

    updateHeader(tree, tabMeta, active);

    // Re-attach preserved content
    for (const [partId, oldEl] of preserved) {
      const newEl = container.querySelector<HTMLElement>(`[data-part-content-for="${partId}"]`);
      if (newEl) {
        newEl.replaceWith(oldEl);
      }
    }

    // Wire click handlers on bottom bar
    const bar = container.querySelector<HTMLElement>(".ghost-compact-bottom-bar");
    bar?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-compact-tab-id]");
      if (btn) {
        const tabId = btn.dataset.compactTabId;
        if (tabId) onTabSelect(tabId);
      }
    });
  }

  render(dockTree, tabs, activeTabId, parts);

  return {
    update(tree, tabMeta, active, partsMap) {
      render(tree, tabMeta, active, partsMap);
    },
    destroy() {
      header.destroy();
      container.innerHTML = "";
    },
  };
}
