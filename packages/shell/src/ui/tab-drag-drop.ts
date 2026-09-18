import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX, TAB_DOCK_DRAG_MIME } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { moveTabBeforeTab, setActiveTab } from "../context-state.js";
import {
  clearActiveDockDragPayload,
  readActiveDockDragPayload,
  setActiveDockDragPayload,
} from "./dock-drag-session.js";
import { handleCrossWindowTabStripDrop } from "./tab-drag-drop-cross-window.js";
import { readDraggedTabPayload, type TabDragPayload } from "./tab-drag-payload.js";

const DEBUG_DND = typeof globalThis !== "undefined" && Reflect.get(globalThis, "__GHOST_DEBUG_DND") === true;
interface TabDragDropDeps {
  onTabMoved: (tabId: string) => void;
  onStateChange: () => void;
}

const pendingDragCleanupByRoot = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const tabDragBindingsByRoot = new WeakMap<HTMLElement, AbortController>();
const SPLITTER_DRAG_ACTIVE_ATTR = "data-dock-splitter-drag-active";

export function wireTabStripDragDrop(root: HTMLElement, runtime: ShellRuntime, deps: TabDragDropDeps): void {
  tabDragBindingsByRoot.get(root)?.abort();
  const bindings = new AbortController();
  tabDragBindingsByRoot.set(root, bindings);
  const listenerOptions = { signal: bindings.signal };

  root.addEventListener(
    "dragend",
    () => {
      scheduleDragCleanup(root);
    },
    listenerOptions,
  );

  root.addEventListener(
    "drop",
    () => {
      scheduleDragCleanup(root);
    },
    listenerOptions,
  );

  const tabItems = getTabDragItems(root);

  for (const tabItem of tabItems) {
    const tabButton = resolveTabButton(tabItem);
    const tabId = readTabItemId(tabItem, tabButton);
    if (!tabButton || !tabId) {
      continue;
    }

    tabButton.draggable = true;
    wireTabDragStartHandler(tabButton, tabItem, tabId, root, runtime, listenerOptions);
    wireTabDragFeedbackHandlers(tabButton, tabId, root, listenerOptions);
    wireTabDropHandler(tabItem, tabId, root, runtime, deps, listenerOptions);
  }
}

function wireTabDragStartHandler(
  tabButton: HTMLButtonElement,
  tabItem: HTMLElement,
  tabId: string,
  root: HTMLElement,
  runtime: ShellRuntime,
  listenerOptions: AddEventListenerOptions,
): void {
  tabButton.addEventListener(
    "dragstart",
    (event) => {
      cancelPendingDragCleanup(root);

      if (isSplitterDragActive(root)) {
        event.preventDefault();
        return;
      }

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !tabId || runtime.syncDegraded) {
        if (DEBUG_DND)
          console.log("[shell:dnd:tab] dragstart-blocked", {
            hasDataTransfer: Boolean(dataTransfer),
            tabId,
            syncDegraded: runtime.syncDegraded,
            stack: new Error().stack,
          });
        return;
      }

      const payload: TabDragPayload = {
        kind: "shell-tab-dnd",
        tabId,
        sourceWindowId: runtime.windowId,
      };

      dataTransfer.setData(
        TAB_DOCK_DRAG_MIME,
        JSON.stringify({
          tabId,
          sourceWindowId: runtime.windowId,
        }),
      );
      setActiveDockDragPayload(root, {
        tabId,
        sourceWindowId: runtime.windowId,
      });

      if (runtime.dragSessionBroker.available) {
        const ref = runtime.dragSessionBroker.create(payload);
        dataTransfer.setData(
          "text/plain",
          ref ? `${DRAG_REF_PREFIX}${ref.id}` : `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`,
        );
      } else {
        dataTransfer.setData("text/plain", `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`);
      }

      dataTransfer.effectAllowed = "move";
      if (typeof dataTransfer.setDragImage === "function") {
        dataTransfer.setDragImage(tabButton ?? tabItem, 16, 12);
      }
    },
    listenerOptions,
  );
}

function wireTabDragFeedbackHandlers(
  tabButton: HTMLButtonElement,
  tabId: string,
  root: HTMLElement,
  listenerOptions: AddEventListenerOptions,
): void {
  tabButton.addEventListener(
    "drag",
    () => {
      const activePayload = readActiveDockDragPayload(root);
      if (activePayload?.tabId !== tabId) {
        return;
      }
      addRootClass(root, "is-dock-dragging");
    },
    listenerOptions,
  );

  tabButton.addEventListener(
    "dragend",
    () => {
      scheduleDragCleanup(root);
    },
    listenerOptions,
  );
}

function wireTabDropHandler(
  tabItem: HTMLElement,
  tabId: string,
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: TabDragDropDeps,
  listenerOptions: AddEventListenerOptions,
): void {
  tabItem.addEventListener(
    "dragover",
    (event) => {
      if (!event.dataTransfer || runtime.syncDegraded) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    listenerOptions,
  );

  tabItem.addEventListener(
    "drop",
    (event) => {
      handleTabDrop(event, tabId, root, runtime, deps);
    },
    listenerOptions,
  );
}

function handleTabDrop(
  event: DragEvent,
  targetTabId: string,
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: TabDragDropDeps,
): void {
  event.preventDefault();
  cancelPendingDragCleanup(root);
  const dataTransfer = event.dataTransfer;
  if (runtime.syncDegraded || !dataTransfer) {
    clearDragState(root);
    if (DEBUG_DND)
      console.log("[shell:dnd:tab] drop-blocked", {
        hasDataTransfer: Boolean(dataTransfer),
        syncDegraded: runtime.syncDegraded,
        targetTabId,
        stack: new Error().stack,
      });
    return;
  }

  const resolved = readDraggedTabPayload(runtime, dataTransfer, root);
  clearDragState(root);
  if (!targetTabId || !resolved || resolved.payload.tabId === targetTabId) {
    return;
  }

  const payload = resolved.payload;
  const isCrossWindow = payload.sourceWindowId !== runtime.windowId;
  if (isCrossWindow) {
    handleCrossWindowTabStripDrop(
      runtime,
      {
        tabId: payload.tabId,
        sourceWindowId: payload.sourceWindowId,
        targetTabId,
        transferSessionId: resolved.transferSessionId,
      },
      {
        onTabMoved: deps.onTabMoved,
        onStateChange: deps.onStateChange,
      },
    );
    return;
  }

  const reordered = moveTabBeforeTab(runtime.contextState, {
    tabId: payload.tabId,
    beforeTabId: targetTabId,
  });
  if (reordered === runtime.contextState) {
    return;
  }

  updateContextState(runtime, reordered);
  updateContextState(runtime, setActiveTab(runtime.contextState, payload.tabId));
  if (resolved.transferSessionId) {
    runtime.dragSessionBroker.commit({ id: resolved.transferSessionId }, runtime.windowId);
  }
  deps.onTabMoved(payload.tabId);
}

function getTabDragItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-tab-item]"));
}

function scheduleDragCleanup(root: HTMLElement): void {
  cancelPendingDragCleanup(root);
  const timeout = setTimeout(() => {
    clearDragState(root);
    pendingDragCleanupByRoot.delete(root);
  }, 0);
  pendingDragCleanupByRoot.set(root, timeout);
}

function cancelPendingDragCleanup(root: HTMLElement): void {
  const pending = pendingDragCleanupByRoot.get(root);
  if (!pending) {
    return;
  }

  clearTimeout(pending);
  pendingDragCleanupByRoot.delete(root);
}

function clearDragState(root: HTMLElement): void {
  clearActiveDockDragPayload(root);
  removeRootClass(root, "is-dock-dragging");
}

function resolveTabButton(tabItem: HTMLElement): HTMLButtonElement | null {
  if (typeof (tabItem as Partial<HTMLButtonElement>).dataset?.partId === "string") {
    return tabItem as unknown as HTMLButtonElement;
  }

  if (typeof (tabItem as Partial<HTMLElement>).querySelector === "function") {
    return tabItem.querySelector<HTMLButtonElement>("button[data-action='activate-tab']");
  }

  return null;
}

function readTabItemId(tabItem: HTMLElement, tabButton: HTMLButtonElement | null): string | undefined {
  const itemDataset = (tabItem as Partial<HTMLElement>).dataset;
  return itemDataset && typeof itemDataset.tabItem === "string" ? itemDataset.tabItem : tabButton?.dataset.partId;
}

function isSplitterDragActive(root: HTMLElement): boolean {
  return (
    typeof (root as Partial<HTMLElement>).hasAttribute === "function" && root.hasAttribute(SPLITTER_DRAG_ACTIVE_ATTR)
  );
}

function addRootClass(root: HTMLElement, className: string): void {
  if (root.classList && typeof root.classList.add === "function") root.classList.add(className);
}

function removeRootClass(root: HTMLElement, className: string): void {
  if (root.classList && typeof root.classList.remove === "function") root.classList.remove(className);
}
