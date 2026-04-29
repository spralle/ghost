// plugin-services.ts — Plugin-facing service accessor types.
//
// These types represent the read-only subset of ShellServiceRegistry
// that plugins use to consume shell-provided services via the mount context.
//
// Usage in a plugin mount function:
//
//   import type { PluginServices, ThemeService } from "@ghost-shell/contracts";
//   import { THEME_SERVICE_ID } from "@ghost-shell/contracts";
//
//   export function mount(target: HTMLElement, context: PluginMountContext) {
//     const theme = context.runtime.services.getService<ThemeService>(THEME_SERVICE_ID);
//     if (theme) {
//       const themes = theme.listThemes();
//     }
//   }

import type { ServiceToken } from "./service-token.js";

// ---------------------------------------------------------------------------
// Service accessor
// ---------------------------------------------------------------------------

/** Read-only service accessor available to plugins via the mount context. */
export interface PluginServices {
  /** Get a service by typed token. Returns null if not registered. */
  getService<T>(token: ServiceToken<T>): T | null;
  /** Get a service by string ID (legacy). Returns null if not registered. */
  getService<T = unknown>(id: string): T | null;

  /** Check if a service is registered. */
  hasService(id: string): boolean;
}

// ---------------------------------------------------------------------------
// Mount context
// ---------------------------------------------------------------------------

/**
 * Plugin mount context — the typed shape that plugins receive when mounted.
 *
 * Plugins should type their mount function argument with this interface
 * to get proper typing for service access without importing shell-internal types.
 */
export interface PluginMountContext {
  /** Plugin part metadata. */
  part: { id: string; title: string; component: string };
  /** Unique instance ID for this mounted part. */
  instanceId: string;
  /** Definition ID for this part type. */
  definitionId: string;
  /** Arguments passed to the part. */
  args: Record<string, string>;
  /** Runtime services accessor. */
  runtime: {
    services: PluginServices;
  };
}

// ---------------------------------------------------------------------------
// Plugin mount function types
// ---------------------------------------------------------------------------

/** Cleanup handle returned by a plugin part mount function. */
export interface PartMountCleanup {
  unmount: () => void;
}

/** Standard mount function signature for plugin parts. */
export type MountPartFn = (target: HTMLElement, context: PluginMountContext) => Promise<PartMountCleanup>;
