import type { NavigationHints, NavigationTarget, PlacementHint } from "../core/types.js";
import type { NavigationHandlerOptions, NavigationModifierMap } from "./link-types.js";
import { DEFAULT_MODIFIER_MAP } from "./link-types.js";

/**
 * Options for {@link createNavigationHandler}, extending {@link NavigationHandlerOptions}
 * with a required navigation dispatch callback.
 */
export interface CreateNavigationHandlerOptions extends NavigationHandlerOptions {
  /** Callback invoked to perform the actual navigation. */
  readonly onNavigate: (target: NavigationTarget, hints: NavigationHints) => void;
}

/**
 * Detects whether the current platform is macOS.
 * On Mac, Meta (⌘) is the primary modifier instead of Ctrl.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform?.includes("Mac") || navigator.userAgent?.includes("Mac");
}

/**
 * Resolves which {@link PlacementHint} applies based on modifier keys
 * and mouse button state from a user interaction event.
 *
 * On macOS, `metaKey` (⌘) is used in place of `ctrlKey` for the
 * "ctrl" and "ctrlShift" modifier slots.
 *
 * @example
 * ```ts
 * // Middle-click → background tab
 * const hint = resolveModifiers(middleClickEvent, DEFAULT_MODIFIER_MAP);
 * // hint === "background"
 *
 * // Ctrl+Click on Windows → auto
 * const hint = resolveModifiers(ctrlClickEvent, DEFAULT_MODIFIER_MAP);
 * // hint === "auto"
 * ```
 *
 * @param event - The mouse or keyboard event to inspect.
 * @param modifierMap - Mapping from modifier combinations to placement hints.
 * @returns The resolved placement hint.
 */
export function resolveModifiers(
  event: MouseEvent | KeyboardEvent,
  modifierMap: NavigationModifierMap = DEFAULT_MODIFIER_MAP,
): PlacementHint {
  const plain = modifierMap.plain ?? DEFAULT_MODIFIER_MAP.plain ?? "auto";
  const ctrl = modifierMap.ctrl ?? DEFAULT_MODIFIER_MAP.ctrl ?? "auto";
  const ctrlShift = modifierMap.ctrlShift ?? DEFAULT_MODIFIER_MAP.ctrlShift ?? "split";
  const shift = modifierMap.shift ?? DEFAULT_MODIFIER_MAP.shift ?? "detach";
  const middle = modifierMap.middle ?? DEFAULT_MODIFIER_MAP.middle ?? "background";
  const isMac = isMacPlatform();

  // Middle mouse button
  if ("button" in event && event.button === 1) {
    return middle;
  }

  const primaryModifier = isMac ? event.metaKey : event.ctrlKey;

  if (primaryModifier && event.shiftKey) {
    return ctrlShift;
  }
  if (primaryModifier) {
    return ctrl;
  }
  if (event.shiftKey) {
    return shift;
  }

  return plain;
}

/**
 * Resolves full {@link NavigationHints} by combining default hints with
 * modifier-detected placement. Modifier-based navigation (new tab, split,
 * window) forces history to "push" since a new container is being created.
 *
 * @example
 * ```ts
 * const hints = resolveHintsFromEvent(event, { open: "replace" }, DEFAULT_MODIFIER_MAP);
 * // If Ctrl was held: { open: "auto", history: "push" }
 * // If no modifier:   { open: "replace" }
 * ```
 *
 * @param event - The interaction event.
 * @param defaultHints - Base hints to merge with.
 * @param modifierMap - Custom modifier mapping.
 * @returns Merged navigation hints.
 */
export function resolveHintsFromEvent(
  event: MouseEvent | KeyboardEvent,
  defaultHints: NavigationHints = {},
  modifierMap: NavigationModifierMap = DEFAULT_MODIFIER_MAP,
): NavigationHints {
  const placement = resolveModifiers(event, modifierMap);
  const isModifierNavigation = placement !== "auto" && placement !== "replace";

  return {
    ...defaultHints,
    open: placement,
    history: isModifierNavigation ? "push" : (defaultHints.history ?? "push"),
  };
}

/**
 * Creates a click event handler that resolves modifier keys and dispatches
 * navigation through the provided callback.
 *
 * @example
 * ```ts
 * const handler = createNavigationHandler({
 *   target: { route: "vessel.detail", params: { vesselId: "v123" } },
 *   onNavigate: (target, hints) => router.navigate(target, hints),
 * });
 *
 * element.addEventListener("click", handler);
 * ```
 *
 * @param options - Handler configuration including target and callbacks.
 * @returns An event handler function suitable for "click" or "auxclick" listeners.
 */
export function createNavigationHandler(options: CreateNavigationHandlerOptions): (event: MouseEvent) => void {
  const { target, defaultHints, modifiers, onBeforeNavigate, onNavigate } = options;

  return (event: MouseEvent): void => {
    event.preventDefault();

    const hints = resolveHintsFromEvent(event, defaultHints, modifiers);

    if (onBeforeNavigate) {
      const result = onBeforeNavigate(target, hints);
      if (result === false) return;
    }

    onNavigate(target, hints);
  };
}
