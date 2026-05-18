import type { ShellRuntime } from "../app/types.js";
import { sanitizeForWindowName } from "../app/utils.js";
import type { PartLifecycleDeps } from "./part-instance-tab-lifecycle.js";

export interface GhostOpenRequest {
  hostWindowId: string | null;
  sourcePartId: string | null;
  targetPartId: string;
}

export interface GhostOpenResult {
  status: "opened" | "blocked" | "unavailable" | "rejected";
  notice: string;
}

export interface GhostShimContract {
  open: (request: GhostOpenRequest) => GhostOpenResult;
}

declare global {
  interface Window {
    __ghost?: GhostShimContract;
  }
}

export function openPopout(
  partId: string,
  runtime: ShellRuntime,
  deps: Pick<PartLifecycleDeps, "renderParts" | "renderSyncStatus">,
): void {
  if (runtime.isPopout) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("popout", "1");
  url.searchParams.set("partId", partId);
  url.searchParams.set("hostWindowId", runtime.windowId);

  const popout = window.open(url.toString(), `ghost-popout-${sanitizeForWindowName(partId)}`);
  if (!popout) {
    runtime.notice = `Popup blocked. Could not pop out '${partId}'.`;
    deps.renderSyncStatus();
    return;
  }

  injectGhostShim(popout, partId, runtime, deps);
  runtime.popoutHandles.set(partId, popout);
  runtime.poppedOutTabIds.add(partId);
  runtime.notice = `Part '${partId}' opened in a new window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}

export function requestPopoutFromHostShim(
  targetPartId: string,
  runtime: ShellRuntime,
  deps: Pick<PartLifecycleDeps, "renderSyncStatus">,
): void {
  const shim = window.__ghost;
  if (!shim || typeof shim.open !== "function") {
    runtime.notice = "Host popout bridge unavailable. Please open this popout from the host window.";
    deps.renderSyncStatus();
    return;
  }

  const response = shim.open({
    hostWindowId: runtime.hostWindowId,
    sourcePartId: runtime.popoutTabId,
    targetPartId,
  });

  runtime.notice = response.notice;
  deps.renderSyncStatus();
}

export function restorePart(
  partId: string,
  runtime: ShellRuntime,
  deps: Pick<PartLifecycleDeps, "renderParts" | "renderSyncStatus">,
): void {
  runtime.poppedOutTabIds.delete(partId);

  const handle = runtime.popoutHandles.get(partId);
  if (handle && !handle.closed) {
    handle.close();
  }

  runtime.popoutHandles.delete(partId);
  runtime.notice = `Part '${partId}' restored to host window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}

function injectGhostShim(
  popoutWindow: Window,
  sourcePartId: string,
  runtime: ShellRuntime,
  deps: Pick<PartLifecycleDeps, "renderParts" | "renderSyncStatus">,
): void {
  popoutWindow.__ghost = {
    open(request: GhostOpenRequest): GhostOpenResult {
      if (request.hostWindowId !== runtime.windowId || request.sourcePartId !== sourcePartId) {
        return {
          status: "rejected",
          notice: "Host popout request rejected: ownership mismatch.",
        };
      }

      if (!request.targetPartId || !runtime.contextState.tabs[request.targetPartId]) {
        return {
          status: "rejected",
          notice: "Host popout request rejected: target part not found.",
        };
      }

      if (runtime.poppedOutTabIds.has(request.targetPartId)) {
        return {
          status: "rejected",
          notice: `Part '${request.targetPartId}' is already popped out.`,
        };
      }

      openPopout(request.targetPartId, runtime, deps);

      if (!runtime.poppedOutTabIds.has(request.targetPartId)) {
        return {
          status: "blocked",
          notice: `Popup blocked. Could not pop out '${request.targetPartId}'.`,
        };
      }

      return {
        status: "opened",
        notice: `Host opened part '${request.targetPartId}' in a new window.`,
      };
    },
  };
}
