export { computeAnchorStyles, computeExclusiveZones, getAnchorKey } from "./anchor-positioning.js";
export type { StackedSurface } from "./auto-stacking.js";
export { applyAutoStacking } from "./auto-stacking.js";
export type { FocusGrabManager, FocusGrabOptions } from "./focus-grab.js";
export { createFocusGrabManager } from "./focus-grab.js";
export type { KeyboardExclusiveEntry, KeyboardExclusiveManager } from "./input-behavior.js";
export {
  applyInputBehavior,
  applyKeyboardInteractivity,
  createKeyboardExclusiveManager,
} from "./input-behavior.js";
export { createLayerContainer, removeLayerContainer } from "./layer-dom.js";
export type { ShellLayerSurface } from "./registry.js";
export { BUILTIN_LAYERS, LayerRegistry, SHELL_SURFACE_OWNER } from "./registry.js";

export type { SessionLockManager, SessionLockManagerOptions } from "./session-lock.js";
export { createSessionLockManager } from "./session-lock.js";

export type { LayerSurfaceContextOptions } from "./surface-context.js";
export { createLayerSurfaceContext } from "./surface-context.js";

export { applyVisualEffects, setDynamicOpacity } from "./visual-effects.js";
