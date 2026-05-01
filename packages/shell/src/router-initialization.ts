/**
 * Router initialization — wires @ghost-shell/router into the shell lifecycle.
 *
 * Called during shell bootstrap after workspace state is ready.
 * Returns a dispose function for teardown.
 */

import {
  createDelegatedNavigation,
  initRouter,
  type NavigationAttachment,
  type RouterInitResult,
  type ShellRouter,
  type ShellStateObserver,
} from "@ghost-shell/router";
import type { ShellRuntime } from "./app/types.js";

/** Result of router initialization, including dispose handle. */
export interface ShellRouterHandle {
  readonly router: ShellRouter;
  readonly observer: ShellStateObserver;
  readonly dispose: () => void;
}

/**
 * Initialize the router system and wire it into the shell runtime.
 *
 * - Creates the shell router with workspace-aware codecs
 * - Attaches a state observer to runtime.stateObserver
 * - Sets up delegated navigation on the root element
 * - Reconciles the initial URL
 */
export function initializeShellRouter(root: HTMLElement, runtime: ShellRuntime): ShellRouterHandle {
  const workspaceId = runtime.workspaceManager.activeWorkspaceId;

  const result: RouterInitResult = initRouter({ workspaceId });

  const observer = result.router.createObserver();
  runtime.stateObserver = observer;

  const delegation: NavigationAttachment = createDelegatedNavigation({
    root,
    navigate: (target, hints) => {
      void result.router.navigate(target, hints);
    },
  });

  result.router.reconcileInitialUrl(new URL(window.location.href));

  return {
    router: result.router,
    observer,
    dispose(): void {
      delegation.dispose();
      result.router.dispose();
      runtime.stateObserver = undefined;
    },
  };
}
