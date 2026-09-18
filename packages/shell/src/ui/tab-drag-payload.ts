import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";
import { safeParse } from "../app/utils.js";
import { readActiveDockDragPayload } from "./dock-drag-session.js";
import { readTabDragPayload as readDockTabDragPayload } from "./dock-tab-dnd-payload.js";

export interface TabDragPayload {
  kind: "shell-tab-dnd";
  tabId: string;
  sourceWindowId: string;
}

interface ResolvedTabDragPayload {
  payload: TabDragPayload;
  transferSessionId: string | null;
}

function asTabDragPayload(value: unknown): TabDragPayload | null {
  if (!value || typeof value !== "object") return null;
  const kind = Reflect.get(value, "kind");
  const tabId = Reflect.get(value, "tabId");
  const sourceWindowId = Reflect.get(value, "sourceWindowId");
  if (kind !== "shell-tab-dnd" || typeof tabId !== "string" || typeof sourceWindowId !== "string") {
    return null;
  }
  return { kind, tabId, sourceWindowId };
}

function parseTabDragPayload(runtime: ShellRuntime, raw: string): TabDragPayload | null {
  if (raw.startsWith(DRAG_REF_PREFIX)) {
    const id = raw.slice(DRAG_REF_PREFIX.length);
    return asTabDragPayload(runtime.dragSessionBroker.consume({ id }, runtime.windowId));
  }
  if (raw.startsWith(DRAG_INLINE_PREFIX)) {
    return asTabDragPayload(safeParse(raw.slice(DRAG_INLINE_PREFIX.length)));
  }
  return null;
}

function fromDockPayload(dataTransfer: DataTransfer, runtime: ShellRuntime): ResolvedTabDragPayload | null {
  const dockPayload = readDockTabDragPayload(dataTransfer, runtime, { consumeRef: false });
  if (!dockPayload) return null;
  return {
    payload: {
      kind: "shell-tab-dnd",
      tabId: dockPayload.tabId,
      sourceWindowId: dockPayload.sourceWindowId,
    },
    transferSessionId: dockPayload.transferSessionId ?? null,
  };
}

function fromActivePayload(root: HTMLElement): ResolvedTabDragPayload | null {
  const activePayload = readActiveDockDragPayload(root);
  if (!activePayload) return null;
  return {
    payload: {
      kind: "shell-tab-dnd",
      tabId: activePayload.tabId,
      sourceWindowId: activePayload.sourceWindowId,
    },
    transferSessionId: null,
  };
}

export function readDraggedTabPayload(
  runtime: ShellRuntime,
  dataTransfer: DataTransfer,
  root: HTMLElement,
): ResolvedTabDragPayload | null {
  const rawText = dataTransfer.getData("text/plain");
  const parsedPayload = parseTabDragPayload(runtime, rawText);
  if (parsedPayload) {
    const transferSessionId = rawText.startsWith(DRAG_REF_PREFIX) ? rawText.slice(DRAG_REF_PREFIX.length) : null;
    return { payload: parsedPayload, transferSessionId };
  }
  const dockPayload = fromDockPayload(dataTransfer, runtime);
  if (dockPayload) return dockPayload;
  const activePayload = fromActivePayload(root);
  if (activePayload) return activePayload;
  if (!runtime.contextState.tabs[rawText]) return null;
  return {
    payload: { kind: "shell-tab-dnd", tabId: rawText, sourceWindowId: runtime.windowId },
    transferSessionId: null,
  };
}
