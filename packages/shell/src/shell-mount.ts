/**
 * Shell mounting logic — handles popout vs main-window mount strategies.
 */

import type { ShellRuntime } from "./app/types.js";
import type { ShellBootstrap } from "./bootstrap-shell.js";
import { publishWithDegrade } from "./shell-runtime/bridge-sync-handlers.js";
import { applyLayout, setupResize } from "./shell-runtime/layout-helpers.js";
import {
  bindBridgeSync,
  bindKeyboardShortcuts,
  createBridgeBindings,
  renderParts,
  renderSyncStatus,
} from "./shell-wiring.js";
import { updateWindowReadOnlyState } from "./ui/context-controls.js";
import { startPopoutWatchdog } from "./ui/parts-controller.js";

export function mountShell(root: HTMLElement, runtime: ShellRuntime, bootstrap: ShellBootstrap): () => void {
  const disposers: Array<() => void> = [];

  if (runtime.isPopout) {
    disposers.push(
      bootstrap.mountPopout(root, runtime, {
        renderParts: () => renderParts(root, runtime),
        updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
        setupResize: () => setupResize(root, runtime),
        publishRestoreRequestOnUnload: () => {
          publishWithDegrade(
            root,
            runtime,
            {
              type: "popout-restore-request",
              hostWindowId: runtime.hostWindowId!,
              tabId: runtime.popoutTabId!,
              partId: runtime.popoutTabId!,
              sourceWindowId: runtime.windowId,
            },
            createBridgeBindings(root, runtime),
          );
        },
      }),
    );
  } else {
    disposers.push(
      bootstrap.mountMainWindow(root, {
        renderParts: () => renderParts(root, runtime),
        renderLayerSurfaces: () => bootstrap.renderLayerSurfaces(root, runtime),
        updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
        setupResize: () => setupResize(root, runtime),
        publishRestoreRequestOnUnload: () => {
          console.debug("[shell] Restore request on unload not yet implemented for main window");
        },
      }),
    );
    applyLayout(root, runtime.layout);
    disposers.push(
      startPopoutWatchdog(root, runtime, {
        renderParts: () => renderParts(root, runtime),
        renderSyncStatus: () => renderSyncStatus(root, runtime),
      }),
    );
  }

  disposers.push(
    bindBridgeSync(root, runtime, {
      applyContext: bootstrap.core.applyContext,
      applySelection: bootstrap.core.applySelection,
    }),
  );
  disposers.push(bindKeyboardShortcuts(root, runtime));

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

export function registerRuntimeTeardown(runtime: ShellRuntime): void {
  let closed = false;
  const teardown = () => {
    if (closed) return;
    closed = true;
    runtime.asyncBridge.close();
    runtime.bridge.close();
  };

  window.addEventListener("beforeunload", teardown, { once: true });
}
