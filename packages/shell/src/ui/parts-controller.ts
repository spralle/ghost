import type { ContextTab } from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";
import { getLayoutModeService } from "../services/layout-mode-service-registration.js";
import { type CompactDockHandle, renderCompactDock } from "./compact-dock-renderer.js";
import { wireDockSplitterDrag } from "./dock-splitter-dnd.js";
import { wireDockTabDragDrop } from "./dock-tab-dnd.js";
import { type PartContextMenuDeps, showPartContextMenu } from "./part-context-menu.js";
import { dispatchLocalLifecycleAction } from "./part-instance-lifecycle-dispatch.js";
import { restorePart } from "./part-instance-popout-lifecycle.js";
import {
  closeTabFromUi,
  closeTabThroughRuntime,
  type PartLifecycleDeps,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "./part-instance-tab-lifecycle.js";
import { resolveClosedPopoutTransition } from "./parts-controller-popout-transition.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";
import {
  type ComposedShellPart,
  getVisibleComposedParts,
  renderDockTree,
  renderPartCard,
  resolvePartTitle,
  updateSelectedStyles,
} from "./parts-rendering.js";
import { renderDockSplitTrackValue } from "./parts-rendering-dock-split-style.js";
import { wireTabStripDragDrop } from "./tab-drag-drop.js";

export type { PartsControllerDeps };
export { closeTabFromUi, closeTabThroughRuntime, reopenMostRecentlyClosedTabThroughRuntime, restorePart };

/** Tracks the active compact dock handle for incremental updates. */
let compactHandle: CompactDockHandle | null = null;

function shouldUseCompactRenderer(): boolean {
  const service = getLayoutModeService();
  if (!service) return false;
  return service.capabilities.tabStripPosition === "bottom";
}

export function renderParts(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: PartsControllerDeps,
  options?: { teardownMode?: boolean },
): void {
  const visibleParts = getVisibleComposedParts(runtime);

  if (runtime.isPopout) {
    renderPopoutPart(root, runtime, deps, visibleParts);
    return;
  }

  const dockHost = root.querySelector<HTMLElement>("#dock-tree-root");
  if (dockHost) {
    const visibleDockParts = visibleParts.filter((part) => !runtime.poppedOutTabIds.has(part.instanceId));

    if (shouldUseCompactRenderer() && runtime.contextState.dockTree.root) {
      renderCompactDockMode(dockHost, runtime, visibleDockParts, deps);
    } else {
      // Expanded renderer — destroy any lingering compact handle
      if (compactHandle) {
        compactHandle.destroy();
        compactHandle = null;
      }

      // Preserve mounted plugin content across structural re-renders.
      // Without this, innerHTML destroys all mounted content and forces
      // async re-mounting via Module Federation, causing a visible blank flash.
      // In teardownMode (workspace switch), skip preservation — all content is being destroyed.
      const preserved = new Map<string, HTMLElement>();
      if (!options?.teardownMode) {
        for (const el of dockHost.querySelectorAll<HTMLElement>("[data-part-content-for]")) {
          const partId = el.dataset.partContentFor;
          if (partId && el.childNodes.length > 0) {
            preserved.set(partId, el);
          }
        }
      }

      dockHost.innerHTML = renderDockTree(runtime.contextState.dockTree.root, visibleDockParts, runtime);

      // Re-attach preserved content elements into matching new containers.
      // This keeps the same DOM element references so that syncRenderedParts
      // recognizes them (target === entry.target) and skips re-mounting.
      for (const [partId, oldEl] of preserved) {
        const newEl = dockHost.querySelector<HTMLElement>(`[data-part-content-for="${partId}"]`);
        if (newEl) {
          newEl.replaceWith(oldEl);
        }
      }
    }
  }

  wirePartActions(root, runtime, deps);

  // Activate part instance when clicking inside panel content area.
  if (dockHost) {
    dockHost.addEventListener("pointerdown", (event) => {
      if (runtime.syncDegraded) return;
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-part-id]");
      if (!target) return;
      const partId = target.dataset.partId;
      if (partId && partId !== runtime.selectedPartId) {
        dispatchLocalLifecycleAction(
          runtime,
          {
            actionId: "part-instance.activate",
            tabInstanceId: partId,
            partTitle: resolvePartTitle(partId, runtime),
          },
          deps as PartLifecycleDeps,
        );
      }
    });
  }

  wireDockSplitterDrag(root, runtime, {
    previewSplitStyle: ({ splitId, orientation, ratio }) => {
      previewDockSplitStyle(root, {
        splitId,
        orientation,
        ratio,
      });
    },
    commitRender: () => {
      // State was persisted during drag via updateContextState().
      // CSS preview styles were applied via previewSplitStyle().
      // A full renderParts() would destroy the DOM and cause flickering.
      // The next structural render (tab activation, tab move, etc.) will
      // pick up the persisted ratio and produce matching HTML.
    },
  });
  wireDockTabDragDrop(root, runtime, deps);
  wireTabStripDragDrop(root, runtime, {
    onTabMoved: (tabId) => {
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.activate",
          tabInstanceId: tabId,
          partTitle: resolvePartTitle(tabId, runtime),
        },
        deps as PartLifecycleDeps,
      );
    },
    onStateChange: () => {
      deps.renderContextControls();
      deps.renderParts();
      deps.renderSyncStatus();
    },
  });
  updateSelectedStyles(root, runtime.selectedPartId);
  void deps.partHost.syncRenderedParts(
    root,
    visibleParts.filter((part) => !runtime.poppedOutTabIds.has(part.instanceId)),
  );
}

function renderCompactDockMode(
  dockHost: HTMLElement,
  runtime: ShellRuntime,
  visibleDockParts: ComposedShellPart[],
  deps: PartsControllerDeps,
): void {
  const dockTree = runtime.contextState.dockTree.root!;
  const tabMeta = new Map<string, ContextTab>(
    Object.entries(runtime.contextState.tabs),
  );
  const partsMap = new Map(visibleDockParts.map((p) => [p.instanceId, p]));
  const activeTabId = runtime.selectedPartId ?? runtime.contextState.activeTabId ?? "";

  const onTabSelect = (tabId: string): void => {
    if (runtime.syncDegraded) return;
    dispatchLocalLifecycleAction(
      runtime,
      {
        actionId: "part-instance.activate",
        tabInstanceId: tabId,
        partTitle: resolvePartTitle(tabId, runtime),
      },
      deps as PartLifecycleDeps,
    );
  };

  if (compactHandle) {
    compactHandle.update(dockTree, tabMeta, activeTabId, partsMap);
  } else {
    compactHandle = renderCompactDock(dockHost, dockTree, tabMeta, activeTabId, onTabSelect, partsMap);
  }
}

function previewDockSplitStyle(
  root: HTMLElement,
  input: { splitId: string; orientation: "horizontal" | "vertical"; ratio: number },
): void {
  const splitNode = root.querySelector<HTMLElement>(
    `[data-dock-node-id="${input.splitId}"][data-dock-orientation="${input.orientation}"]`,
  );
  if (!splitNode) {
    return;
  }

  const splitTrackValue = renderDockSplitTrackValue(input.ratio);
  if (input.orientation === "horizontal") {
    splitNode.style.setProperty("grid-template-columns", splitTrackValue);
    return;
  }

  splitNode.style.setProperty("grid-template-rows", splitTrackValue);
}

export function startPopoutWatchdog(
  _root: HTMLElement,
  runtime: ShellRuntime,
  deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">,
): () => void {
  const timerId = window.setInterval(() => {
    const transition = resolveClosedPopoutTransition({
      popoutHandles: runtime.popoutHandles,
      poppedOutTabIds: runtime.poppedOutTabIds,
    });

    for (const partId of transition.closedHandleIds) {
      runtime.popoutHandles.delete(partId);
    }

    for (const partId of transition.restoredTabIds) {
      runtime.poppedOutTabIds.delete(partId);
      runtime.notice = `Part '${partId}' restored (popout closed).`;
      deps.renderParts();
      deps.renderSyncStatus();
    }
  }, 1_000);

  return () => {
    window.clearInterval(timerId);
  };
}

function renderPopoutPart(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: PartsControllerDeps,
  visibleParts: ReturnType<typeof getVisibleComposedParts>,
): void {
  const slot = root.querySelector<HTMLElement>("#popout-slot");
  if (!slot) {
    void deps.partHost.syncRenderedParts(root, []);
    return;
  }

  const part = runtime.popoutTabId ? visibleParts.find((item) => item.instanceId === runtime.popoutTabId) : null;
  if (!part) {
    slot.innerHTML = `<article class="part-root"><h2>Popout unavailable</h2><p>Unable to resolve requested part.</p></article>`;
    void deps.partHost.syncRenderedParts(root, []);
    return;
  }

  slot.innerHTML = renderPartCard(part, runtime, { showPopoutButton: false, showRestoreButton: true });
  wirePartActions(root, runtime, deps);
  wireDockTabDragDrop(root, runtime, deps);
  wireTabStripDragDrop(root, runtime, {
    onTabMoved: (tabId) => {
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.activate",
          tabInstanceId: tabId,
          partTitle: resolvePartTitle(tabId, runtime),
        },
        deps as PartLifecycleDeps,
      );
    },
    onStateChange: () => {
      deps.renderContextControls();
      deps.renderParts();
      deps.renderSyncStatus();
    },
  });
  updateSelectedStyles(root, runtime.selectedPartId);
  void deps.partHost.syncRenderedParts(root, part.pluginId === "shell.utility" ? [] : [part]);
}

function wirePartActions(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='reopen-closed-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.reopen",
        },
        deps as PartLifecycleDeps,
      );
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='activate-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.activate",
          tabInstanceId: button.dataset.partId,
          partTitle: button.dataset.partTitle,
        },
        deps as PartLifecycleDeps,
      );
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='restore']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.restore",
          tabInstanceId: button.dataset.partId,
        },
        deps as PartLifecycleDeps,
      );
    });
  }

  // Wire context menu on part panels
  for (const panel of root.querySelectorAll<HTMLElement>(".dock-tabpanel-content")) {
    panel.addEventListener("contextmenu", (e) => {
      if (runtime.syncDegraded) return;
      const partId = panel.dataset.partId;
      if (!partId) return;
      e.preventDefault();
      showPartContextMenu(e, partId, runtime, deps as PartContextMenuDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='close-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.close",
          tabInstanceId: button.dataset.tabId,
        },
        deps as PartLifecycleDeps,
      );
    });
  }
}
