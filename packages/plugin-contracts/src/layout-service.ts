// layout-service.ts — Public LayoutApiService contract for plugin consumption.
//
// Plugins access layout mode info via:
//   ghost.layout.mode / ghost.layout.onDidChangeMode
//
// This is a stable public API. Internal LayoutModeService details are hidden
// behind an adapter in the shell.

import type { Event } from "./event.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Plugin-facing layout API — read-only view of the current layout mode. */
export interface LayoutApiService {
  /** The current resolved layout mode name (e.g. "compact", "medium", "expanded"). */
  readonly mode: string;
  /** Capabilities of the current mode (tabStripPosition, maxPanes, etc.). */
  readonly capabilities: Readonly<Record<string, unknown>>;
  /** Whether the mode is user-overridden (bypassing automatic rules). */
  readonly isOverridden: boolean;
  /** Fires when the resolved layout mode changes. */
  readonly onDidChangeMode: Event<string>;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the LayoutApiService. */
export const LAYOUT_SERVICE_ID = "ghost.layout" as const;
