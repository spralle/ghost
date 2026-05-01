/**
 * Creates a PluginRouterServiceApi backed by the shell router.
 *
 * This bridges the plugin-facing router factory with the shell's navigation system.
 * Plugins call `api.router.createPluginRouter(routes)` to get a typed router instance.
 */

import type { PluginRouterServiceApi } from "@ghost-shell/contracts";
import { createPluginRouter, type ShellRouter } from "@ghost-shell/router";

export interface PluginRouterServiceOptions {
  readonly getShellRouter: () => ShellRouter | null;
}

/**
 * Create the plugin-facing router service that delegates to the shell router.
 * Returns undefined if no shell router is available (graceful degradation).
 */
export function createPluginRouterServiceApi(options: PluginRouterServiceOptions): PluginRouterServiceApi {
  return {
    createPluginRouter(routes) {
      const shellRouter = options.getShellRouter();
      return createPluginRouter({
        routes,
        initialArgs: {},
        onArgsChange: () => {
          // No-op at activation scope — tab-scoped routers handle args persistence
        },
        onNavigate: shellRouter
          ? (target, hints) => {
              void shellRouter.navigate(target, hints);
            }
          : undefined,
      });
    },
  };
}
