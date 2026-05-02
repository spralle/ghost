/** Configuration for loading states on a route. */
export interface PendingConfig {
  /** Delay in ms before showing pending component. Default: 200. */
  readonly pendingMs?: number;
  /** Component to show while loading (framework-agnostic reference). */
  readonly pendingComponent?: unknown;
  /** Component to show on error (framework-agnostic reference). */
  readonly errorComponent?: unknown;
}

/** Global defaults for pending configuration. */
export interface PendingDefaults {
  readonly pendingMs: number;
  readonly pendingComponent?: unknown;
  readonly errorComponent?: unknown;
}

/** Resolve effective pending config: route-level overrides global defaults. */
export function resolvePendingConfig(
  defaults: PendingDefaults,
  routeConfig?: PendingConfig,
): Required<Pick<PendingConfig, "pendingMs">> & Omit<PendingConfig, "pendingMs"> {
  return {
    pendingMs: routeConfig?.pendingMs ?? defaults.pendingMs,
    pendingComponent: routeConfig?.pendingComponent ?? defaults.pendingComponent,
    errorComponent: routeConfig?.errorComponent ?? defaults.errorComponent,
  };
}
