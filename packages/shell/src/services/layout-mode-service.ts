// layout-mode-service.ts — Observes device/viewport signals and resolves a named layout mode.
//
// Signal collection uses matchMedia + ResizeObserver (no polling).
// Rules engine uses evaluateContributionPredicate for MongoDB-style predicates.
// Hysteresis prevents rapid mode flapping near breakpoints.

import { createEventEmitter, evaluateContributionPredicate } from "@ghost-shell/plugin-system";
import type {
  DisposableLayoutModeService,
  LayoutModeService,
  LayoutOverride,
  LayoutResolutionConfig,
  LayoutRuleset,
  LayoutSignals,
  ModeDefinition,
} from "./layout-mode-types.js";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LAYOUT_RULES: LayoutRuleset = [
  { name: "narrow-viewport", when: { viewportWidth: { $lt: 600 } }, mode: "compact" },
  { name: "short-touch-viewport", when: { viewportHeight: { $lt: 500 }, anyPointerFine: { $eq: false } }, mode: "compact" },
  { name: "medium-touch-only", when: { viewportWidth: { $gte: 600, $lt: 768 }, anyPointerFine: { $eq: false } }, mode: "compact" },
  { name: "medium-viewport", when: { viewportWidth: { $gte: 600, $lt: 1024 } }, mode: "medium" },
  { name: "wide-touch-only", when: { viewportWidth: { $gte: 1024 }, anyPointerFine: { $eq: false }, anyHoverHover: { $eq: false } }, mode: "medium" },
  { name: "wide-viewport", when: { viewportWidth: { $gte: 1024 } }, mode: "expanded" },
];

const STANDARD_MODES: Record<string, ModeDefinition> = {
  compact: { tabStripPosition: "bottom", maxPanes: 1, dockStrategy: "stack" },
  medium: { tabStripPosition: "bottom", maxPanes: 2, dockStrategy: "stack" },
  expanded: { tabStripPosition: "top", maxPanes: Infinity, dockStrategy: "dwindle" },
};

const DEFAULT_CONFIG: LayoutResolutionConfig = {
  debounceMs: 150,
  hysteresisPx: 32,
};

const FALLBACK_MODE = "expanded";

// ---------------------------------------------------------------------------
// Signal collection
// ---------------------------------------------------------------------------

function collectSignals(): LayoutSignals {
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  return {
    viewportWidth: w,
    viewportHeight: h,
    pointer: queryMedia("(pointer: coarse)") ? "coarse" : queryMedia("(pointer: fine)") ? "fine" : "none",
    hover: queryMedia("(hover: hover)") ? "hover" : "none",
    anyPointerFine: queryMedia("(any-pointer: fine)"),
    anyHoverHover: queryMedia("(any-hover: hover)"),
    orientation: w >= h ? "landscape" : "portrait",
    standalone: queryMedia("(display-mode: standalone)"),
    devicePixelRatio: globalThis.devicePixelRatio ?? 1,
  };
}

function queryMedia(query: string): boolean {
  return typeof globalThis.matchMedia === "function" && globalThis.matchMedia(query).matches;
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

function signalsToRecord(s: LayoutSignals): Record<string, unknown> {
  return {
    viewportWidth: s.viewportWidth,
    viewportHeight: s.viewportHeight,
    pointer: s.pointer,
    hover: s.hover,
    anyPointerFine: s.anyPointerFine,
    anyHoverHover: s.anyHoverHover,
    orientation: s.orientation,
    standalone: s.standalone,
    devicePixelRatio: s.devicePixelRatio,
  };
}

function resolveMode(rules: LayoutRuleset, signals: LayoutSignals): string {
  const facts = signalsToRecord(signals);
  for (const rule of rules) {
    if (evaluateContributionPredicate(rule.when, facts)) {
      return rule.mode;
    }
  }
  return FALLBACK_MODE;
}

// ---------------------------------------------------------------------------
// DOM updates
// ---------------------------------------------------------------------------

function applyDomAttributes(mode: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ghost-layout", mode);
  document.documentElement.style.setProperty("--ghost-layout-mode", mode);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateLayoutModeServiceOptions {
  rules?: LayoutRuleset;
  modes?: Record<string, ModeDefinition>;
  config?: Partial<LayoutResolutionConfig>;
  /** Injectable signal source for testing. */
  signalSource?: () => LayoutSignals;
}

export function createLayoutModeService(
  options?: CreateLayoutModeServiceOptions,
): DisposableLayoutModeService {
  const rules = options?.rules ?? DEFAULT_LAYOUT_RULES;
  const modes = options?.modes ?? STANDARD_MODES;
  const config: LayoutResolutionConfig = { ...DEFAULT_CONFIG, ...options?.config };
  const getSignals = options?.signalSource ?? collectSignals;

  const modeEmitter = createEventEmitter<string>();
  const signalsEmitter = createEventEmitter<Readonly<LayoutSignals>>();

  let currentSignals = getSignals();
  let currentMode = resolveMode(rules, currentSignals);
  let override: string | null = null;
  let lastBreakpointWidth = currentSignals.viewportWidth;
  let lastDirection: "up" | "down" | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const disposables: Array<{ dispose(): void }> = [];

  applyDomAttributes(override ?? currentMode);

  function getEffectiveMode(): string {
    return override ?? currentMode;
  }

  function getCapabilities(): Readonly<ModeDefinition> {
    const m = getEffectiveMode();
    return modes[m] ?? modes[FALLBACK_MODE] ?? STANDARD_MODES[FALLBACK_MODE];
  }

  function shouldAllowModeChange(newWidth: number, newMode: string): boolean {
    if (newMode === currentMode) return false;
    const direction: "up" | "down" = newWidth > lastBreakpointWidth ? "up" : "down";
    if (lastDirection !== null && direction !== lastDirection) {
      const delta = Math.abs(newWidth - lastBreakpointWidth);
      if (delta < config.hysteresisPx) return false;
    }
    return true;
  }

  function processSignalChange(): void {
    const newSignals = getSignals();
    const signalsChanged =
      newSignals.viewportWidth !== currentSignals.viewportWidth ||
      newSignals.viewportHeight !== currentSignals.viewportHeight ||
      newSignals.pointer !== currentSignals.pointer ||
      newSignals.hover !== currentSignals.hover ||
      newSignals.anyPointerFine !== currentSignals.anyPointerFine ||
      newSignals.anyHoverHover !== currentSignals.anyHoverHover ||
      newSignals.orientation !== currentSignals.orientation ||
      newSignals.standalone !== currentSignals.standalone;

    if (!signalsChanged) return;

    currentSignals = newSignals;
    signalsEmitter.fire(newSignals);

    if (override !== null) return;

    const newMode = resolveMode(rules, newSignals);
    if (newMode === currentMode) return;

    if (!shouldAllowModeChange(newSignals.viewportWidth, newMode)) return;

    const direction: "up" | "down" = newSignals.viewportWidth > lastBreakpointWidth ? "up" : "down";
    lastDirection = direction;
    lastBreakpointWidth = newSignals.viewportWidth;
    currentMode = newMode;
    applyDomAttributes(newMode);
    modeEmitter.fire(newMode);
  }

  function scheduleUpdate(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processSignalChange, config.debounceMs);
  }

  // Set up observers if DOM is available
  if (typeof document !== "undefined" && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(document.documentElement);
    disposables.push({ dispose: () => ro.disconnect() });
  }

  // Media query listeners
  const mediaQueries = [
    "(pointer: coarse)", "(pointer: fine)", "(hover: hover)",
    "(any-pointer: fine)", "(any-hover: hover)", "(display-mode: standalone)",
  ];
  for (const query of mediaQueries) {
    if (typeof globalThis.matchMedia !== "function") break;
    const mql = globalThis.matchMedia(query);
    const handler = () => scheduleUpdate();
    mql.addEventListener("change", handler);
    disposables.push({ dispose: () => mql.removeEventListener("change", handler) });
  }

  const result: DisposableLayoutModeService = {
    get mode() { return getEffectiveMode(); },
    get capabilities() { return getCapabilities(); },
    get signals() { return currentSignals; },
    get isOverridden() { return override !== null; },
    onDidChangeMode: modeEmitter.event,
    onDidChangeSignals: signalsEmitter.event,

    setOverride(o: LayoutOverride): void {
      const prev = getEffectiveMode();
      override = o.mode;
      const next = getEffectiveMode();
      if (next !== prev) {
        applyDomAttributes(next);
        modeEmitter.fire(next);
      }
    },

    notifySignalsChanged(): void {
      if (config.debounceMs <= 0) {
        processSignalChange();
      } else {
        scheduleUpdate();
      }
    },

    getContextFacts(): Record<string, unknown> {
      const caps = getCapabilities();
      return {
        "layout.mode": getEffectiveMode(),
        "layout.tabStripPosition": caps.tabStripPosition,
        "layout.maxPanes": caps.maxPanes,
        "layout.dockStrategy": caps.dockStrategy,
        "layout.pointer": currentSignals.pointer,
        "layout.hover": currentSignals.hover,
        "layout.orientation": currentSignals.orientation,
        "layout.standalone": currentSignals.standalone,
      };
    },

    dispose(): void {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      for (const d of disposables) d.dispose();
      modeEmitter.dispose();
      signalsEmitter.dispose();
    },
  };

  return result;
}
