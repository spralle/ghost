/** Cubic bezier control points. P0=(0,0) and P3=(1,1) are implicit. */
export interface BezierPoints {
  /** First control point X. Must be [0, 1]. */
  readonly x1: number;
  /** First control point Y. Range [-2, 2] allows overshoot/bounce. */
  readonly y1: number;
  /** Second control point X. Must be [0, 1]. */
  readonly x2: number;
  /** Second control point Y. Range [-2, 2] allows overshoot/bounce. */
  readonly y2: number;
}

/** Named bezier curve for the curve registry. */
export interface NamedBezierCurve {
  /** Unique name, referenced by animation entries. */
  readonly name: string;
  /** Control points defining the cubic-bezier shape. */
  readonly points: BezierPoints;
}

/** Per-animation override entry. All fields optional — missing fields inherit from parent. */
export interface AnimationEntry {
  /** Enable/disable this animation. When false, zero CSS generated. */
  readonly enabled?: boolean | undefined;
  /** Duration in deciseconds (1ds = 100ms). */
  readonly speed?: number | undefined;
  /** Name reference to a curve in the curves array. */
  readonly curve?: string | undefined;
  /** Style variant. Valid values depend on the animation category. */
  readonly style?: string | undefined;
  /** Numeric parameter for the style (e.g., 80 for popin 80%). */
  readonly styleParam?: number | undefined;
}

/** Top-level motion configuration. */
export interface GhostMotionConfig {
  /** Global kill switch. False = zero animation CSS injected. */
  readonly enabled: boolean;
  /** Named bezier curve registry. Array for formbar dynamic binding. */
  readonly curves: readonly NamedBezierCurve[];
  /** Per-animation overrides. Omitted entries inherit from parent in tree. */
  readonly animations: Partial<Record<AnimationName, AnimationEntry>>;
}

/**
 * All valid animation names corresponding to the animation tree.
 * Children inherit from parents unless explicitly overridden.
 */
export type AnimationName =
  | "windows"
  | "windowsIn"
  | "windowsOut"
  | "layers"
  | "layersIn"
  | "layersOut"
  | "fade"
  | "fadeIn"
  | "fadeOut"
  | "fadeDim"
  | "fadeLayersIn"
  | "fadeLayersOut"
  | "border"
  | "borderangle"
  | "workspaces"
  | "workspacesIn"
  | "workspacesOut"
  | "edgePanel";

/** Style variants allowed per animation category. */
export type WindowsStyle = "slide" | "popin";
export type LayersStyle = "slide" | "popin" | "fade";
export type WorkspacesStyle = "slide" | "slidevert" | "fade" | "slidefade" | "slidefadevert";
export type BorderAngleStyle = "once" | "loop";
export type EdgePanelStyle = "slide" | "fade";

/** Animation tree node definition. */
export interface AnimationTreeNode {
  /** Parent node name, or null for root nodes. */
  readonly parent: string | null;
  /** Valid style variant names for this node. */
  readonly styles: readonly string[];
  /** CSS selector targeting the real shell DOM element. */
  readonly cssTarget: string;
  /** Map of style variant name to @keyframes name. */
  readonly keyframesMap: Readonly<Record<string, string>>;
  /** CSS properties for transition-based animations (no keyframes). */
  readonly transitionProps?: readonly string[] | undefined;
}
