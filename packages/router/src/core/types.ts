/**
 * How a navigation target should be opened in the shell layout.
 *
 * - `auto` — Navigate. Layout engine decides where. Adds to navHistory (back returns).
 * - `replace` — Swap in place. No navHistory change. For filter/param updates.
 * - `split` — Side-by-side. Degrades gracefully based on maxPanes.
 * - `background` — Open without taking focus.
 * - `detach` — Pop to own window. Degrades to auto on compact.
 *
 * @example
 * ```ts
 * navigate(target, { open: "auto" });
 * navigate(target, { open: "replace" });
 * ```
 */
export type PlacementHint =
  | "auto" // Layout engine decides
  | "replace" // Swap in place, no navHistory change
  | "split" // Side-by-side pane
  | "background" // Open without taking focus
  | "detach"; // Pop to own window

/**
 * Navigation target — either a direct route reference or an intent for cross-plugin resolution.
 *
 * @example
 * ```ts
 * // Direct route (within same plugin, type-safe)
 * const target: NavigationTarget = {
 *   route: "vessel.detail",
 *   params: { vesselId: "v123" },
 * };
 *
 * // Intent-based (cross-plugin, runtime-resolved)
 * const target: NavigationTarget = {
 *   intent: "domain.entity.open",
 *   facts: { entityType: "vessel", entityId: "v123" },
 * };
 * ```
 */
export type NavigationTarget =
  | { readonly route: string; readonly params: Readonly<Record<string, string>> }
  | { readonly intent: string; readonly facts: Readonly<Record<string, unknown>> };

/**
 * Hints controlling where and how a navigation target is opened.
 *
 * @example
 * ```ts
 * navigate(target, {
 *   open: "auto",
 *   history: "push",
 *   activate: true,
 * });
 * ```
 */
export interface NavigationHints {
  /** Where to open the target in the shell layout. Default: "auto" */
  readonly open?: PlacementHint | undefined;
  /** Whether to push a new history entry or replace the current one. Default: "push" */
  readonly history?: "push" | "replace" | undefined;
  /** Context group to open in. */
  readonly group?: string | undefined;
  /** Split direction when open is "split". */
  readonly direction?: "h" | "v" | undefined;
  /** Whether to activate/focus the target after opening. Default: true */
  readonly activate?: boolean | undefined;
}

/**
 * Configurable link-open policy for handling Ghost deep links.
 * "reuse" and "new-workspace" are reserved for future BroadcastChannel-based resolution.
 */
export type LinkOpenPolicy =
  | "reuse" // Find existing Ghost window, navigate there (future)
  | "new-workspace" // Open new workspace in existing Ghost window (future)
  | "new-instance" // Open new browser tab with fresh Ghost instance
  | "auto"; // Try reuse → fall back to new-instance (future)

/**
 * Result of a navigation operation.
 */
export type NavigationResult =
  | { readonly outcome: "navigated"; readonly tabId: string }
  | { readonly outcome: "replaced"; readonly tabId: string }
  | { readonly outcome: "no-match"; readonly reason: string }
  | { readonly outcome: "cancelled" };
