// layout-mode-types.ts — Core types for the layout mode service.

import type { Disposable, Event } from "@ghost-shell/contracts";

/** Raw device/viewport signals sampled from the environment. */
export interface LayoutSignals {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly pointer: "coarse" | "fine" | "none";
  readonly hover: "hover" | "none";
  readonly anyPointerFine: boolean;
  readonly anyHoverHover: boolean;
  readonly orientation: "portrait" | "landscape";
  readonly standalone: boolean;
  readonly devicePixelRatio: number;
}

/** A rule mapping signals to a mode name. First match wins. */
export interface LayoutRule {
  readonly name: string;
  readonly when: Record<string, unknown>;
  readonly mode: string;
}

export type LayoutRuleset = readonly LayoutRule[];

/** A mode definition — maps a name to a set of capabilities. */
export interface ModeDefinition {
  tabStripPosition: "top" | "bottom";
  maxPanes: number;
  dockStrategy: string;
  [key: string]: unknown;
}

/** User override — forces a specific mode, bypassing rules. */
export interface LayoutOverride {
  readonly mode: string | null;
}

/** Configuration for mode resolution behavior. */
export interface LayoutResolutionConfig {
  readonly debounceMs: number;
  readonly hysteresisPx: number;
}

/** The internal layout mode service interface. */
export interface LayoutModeService {
  readonly mode: string;
  readonly capabilities: Readonly<ModeDefinition>;
  readonly signals: Readonly<LayoutSignals>;
  readonly isOverridden: boolean;
  readonly onDidChangeMode: Event<string>;
  readonly onDidChangeSignals: Event<Readonly<LayoutSignals>>;
  setOverride(override: LayoutOverride): void;
  /** Trigger re-evaluation of signals. Useful for programmatic testing or non-standard signal sources. */
  notifySignalsChanged(): void;
  getContextFacts(): Record<string, unknown>;
}

/** Combined service + disposable for the factory return type. */
export type DisposableLayoutModeService = LayoutModeService & Disposable;
