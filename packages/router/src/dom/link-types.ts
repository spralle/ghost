import type { NavigationHints, NavigationTarget, PlacementHint } from "../core/types.js";

/**
 * Maps keyboard/mouse modifier combinations to placement hints.
 * Configurable to allow different modifier behaviors.
 *
 * @example
 * ```ts
 * // Default mapping:
 * const defaultModifiers: NavigationModifierMap = {
 *   plain: "auto",
 *   ctrl: "auto",
 *   ctrlShift: "split",
 *   shift: "detach",
 *   middle: "background",
 * };
 *
 * // Custom: make Ctrl+click open in split instead of tab
 * const custom: NavigationModifierMap = {
 *   ...defaultModifiers,
 *   ctrl: "split",
 *   ctrlShift: "detach",
 * };
 * ```
 */
export interface NavigationModifierMap {
  /** Click with no modifiers. Default: "auto" */
  readonly plain?: PlacementHint | undefined;
  /** Ctrl+Click (Cmd+Click on macOS). Default: "auto" */
  readonly ctrl?: PlacementHint | undefined;
  /** Ctrl+Shift+Click. Default: "split" */
  readonly ctrlShift?: PlacementHint | undefined;
  /** Shift+Click. Default: "detach" */
  readonly shift?: PlacementHint | undefined;
  /** Middle mouse button click. Default: "background" */
  readonly middle?: PlacementHint | undefined;
}

/**
 * Default modifier-to-placement mapping.
 */
export const DEFAULT_MODIFIER_MAP: Readonly<Required<NavigationModifierMap>> = {
  plain: "auto",
  ctrl: "auto",
  ctrlShift: "split",
  shift: "detach",
  middle: "background",
} as const;

/**
 * Options for creating a navigation event handler.
 */
export interface NavigationHandlerOptions {
  /** The navigation target to open when triggered. */
  readonly target: NavigationTarget;
  /** Default hints (overridden by modifier key detection). */
  readonly defaultHints?: NavigationHints | undefined;
  /** Custom modifier mapping. */
  readonly modifiers?: NavigationModifierMap | undefined;
  /** Callback invoked with the resolved navigation. Return false to cancel. */
  readonly onBeforeNavigate?: (target: NavigationTarget, hints: NavigationHints) => boolean | undefined;
}

/**
 * Options for the delegated data-ghost-navigate handler.
 */
export interface DelegatedNavigationOptions {
  /** Root element to attach the delegated listener to. */
  readonly root: HTMLElement;
  /** Custom modifier mapping applied to all delegated links. */
  readonly modifiers?: NavigationModifierMap | undefined;
  /** Navigation dispatch function (provided by shell router). */
  readonly navigate: (target: NavigationTarget, hints: NavigationHints) => void;
}

/**
 * Return type for attachNavigation — includes cleanup disposal.
 */
export interface NavigationAttachment {
  /** Remove all event listeners and clean up. */
  dispose(): void;
}

/**
 * Data attributes used by the delegated navigation system.
 * Elements with these attributes are automatically wired for navigation.
 *
 * @example
 * ```html
 * <a data-ghost-navigate
 *    data-route="vessel.detail"
 *    data-params='{"vesselId":"v123"}'
 *    data-open="replace">
 *   View Vessel
 * </a>
 * ```
 */
export const NAVIGATION_DATA_ATTRIBUTES = {
  /** Marker attribute — presence enables navigation handling */
  navigate: "data-ghost-navigate",
  /** Route ID for direct route navigation */
  route: "data-route",
  /** JSON-encoded route params */
  params: "data-params",
  /** Intent type for cross-plugin navigation */
  intent: "data-intent",
  /** JSON-encoded intent facts */
  facts: "data-facts",
  /** Placement hint override */
  open: "data-open",
  /** History hint override */
  history: "data-history",
} as const;
