# ADR: Adaptive Layout & Mobile Shell

## Status

Accepted (2026-05-01)

**Epic**: `armada-cygf` - Ghost shell responsive layout and overlay infrastructure

## Context

Ghost Shell is a VS Code-inspired plugin shell with a tiling dock tree, layered surface system, and two-layer router. The current architecture is desktop-first: the dock tree renders as splits and tab strips, edge slots provide chrome at the viewport periphery, and the layout assumes a large viewport.

Several requirements drive the need for adaptive layout support:

1. **Mobile workforce**: Operational users need full productivity on phones — process-driven data entry, task management, entity lookup. This is not a "mobile companion" but a primary work surface.
2. **Tablet support**: Tablets in landscape mode benefit from master-detail patterns. Portrait tablets should feel like a large phone.
3. **PWA + native shell**: The same codebase must serve as a PWA in mobile browsers AND inside native wrappers (Cordova, Capacitor) without separate builds.
4. **Responsive desktop**: Resizing a desktop browser window below a threshold should seamlessly switch to the compact layout and back.
5. **Unified concepts**: Core architectural concepts must translate across all form factors. No form-factor-specific types or subsystems unless explicitly justified.

### Existing Foundations

The architecture already provides strong building blocks:

- **DockStackNode with navHistory**: The "stack" placement strategy implements single-panel + back/forward navigation — the core mobile navigation primitive.
- **When-condition predicates**: Layer surfaces can be conditionally shown/hidden based on runtime facts (`when` clauses evaluated by the predicate engine).
- **Container queries**: `.part-root` sets `container-type: inline-size` — plugins can adapt to available width without knowing the shell layout.
- **Menu contribution system**: `PluginMenuContribution` with `when` predicates, `group`, `order` — follows the VS Code contribution model.
- **PartSnapshot system**: Opt-in `SnapshotCapable` interface for capturing/restoring ephemeral UI state (scroll position, component state).
- **Tab state preservation**: Each tab has a `ContextTab` with `args` (including `_route` and route params) and `subcontextsByTab` lane values — full routing state preserved per tab. Within a dock stack, inactive tab panels get `display: none` (DOM stays alive), preserving scroll position and form state on back navigation.
- **Predicate engine**: `@weaver/predicate` provides MongoDB-style query evaluation, already used for `when` clauses on actions, menus, keybindings, and layer surfaces.

### Planned Foundation (Epic armada-cygf)

- **Generic Drawer/Sheet** (armada-k3cs): Temporary overlay panels via shell API.
- **Topbar Overflow** (armada-2ovz): Priority-based collapse of slot contributions.

Note: armada-3bq1 (Layout Mode Service) is superseded by this ADR's more comprehensive mode resolution design.

### Router Architecture Context

A comparison with modern routing frameworks (TanStack Router, React Router v7, Next.js App Router, Expo Router, React Navigation) reveals that Ghost Shell's routing architecture is **unique in the industry**:

- **PlacementHints**: No mainstream router has explicit control over *where* navigation content appears. Every other framework assumes "navigation = render in the one outlet."
- **Intent-based cross-plugin navigation**: Unique to Ghost Shell. Plugins navigate by intent, the system resolves at runtime.
- **Multi-panel URL encoding**: Ghost Shell's pluggable codec system can serialize multi-tab/multi-split state to URLs — no other router does this.
- **Dynamic layout composition**: Next.js parallel routes (`@slots`) come closest, but are static at build time. Ghost Shell's dock tree is user-composable at runtime.

**Known gaps** vs modern routers (separate from this ADR):
- Scroll restoration (critical for mobile back navigation)
- View transition animations (important for mobile stack push/pop UX)
- Global navigation guards/middleware (useful for "unsaved changes?" prompts)

## Decision

Adopt an **adaptive rendering model** with two core innovations:

1. **Rule-based layout mode resolution**: Device signals (viewport, pointer type, hover capability, orientation) are evaluated by a configurable rules engine to resolve a named layout mode. Each mode carries a set of capabilities that drive structural decisions.
2. **Same data, different renderer**: The dock tree types are never modified. A compact renderer shows all tabs from the entire workspace tree as a flat bottom bar with full-screen content. Resizing back to expanded restores the exact split layout.

### V1 Scope

This ADR covers the **responsive infrastructure foundation**:

- Layout Mode Service with rule-based resolution and capabilities
- Compact dock renderer (bottom bar from flattened tree + full-screen content)
- PlacementHint simplification
- `when` predicate support on PluginSlotContribution
- Stack strategy enforcement in compact mode

**Explicitly deferred** to future phases:
- Navigation destinations as a formal contribution concept
- Per-destination independent stacks
- Tenant/user configuration of navigation items
- Cross-destination navigation routing
- Part pin/reuse policy
- Master-detail / part linking / data providers
- Scroll restoration and transition animations
- Offline shell support

### Key Principles

1. **Same data, different renderer**: The dock tree types (`DockSplitNode`, `DockStackNode`) are never modified for mobile. The compact renderer traverses the entire tree and presents it differently.
2. **Modes carry capabilities**: A resolved mode name maps to a set of capabilities (key-value pairs). Plugins and the shell check capabilities, not mode names. The capability set is extensible.
3. **PlacementHints express intent, not layout**: Callers say "auto" (navigate), "replace" (in-place), "split" (side-by-side), "background" (don't focus), or "detach" (own window). The layout engine resolves these based on mode capabilities.
4. **Resize preserves tree integrity**: Switching from expanded to compact mode does NOT mutate the dock tree. The compact renderer renders a different view of the same data. Switching back is instant and lossless.
5. **No form-factor-specific types**: No `MobileStackNode` or `CompactLayout` types. The existing dock tree, placement strategies, and contribution system serve all modes.

## 1) Layout Mode Service — Rule-Based Resolution

### Architecture

```
┌─────────────────┐     ┌────────────────┐     ┌───────────────────┐
│  Layout Signals  │ ──→ │  Rules Engine   │ ──→ │  Resolved Mode    │
│  (viewport,      │     │  (first-match   │     │  name: "compact"  │
│   pointer,       │     │   wins, uses    │     │                   │
│   hover, etc.)   │     │   @weaver/      │     │  Capabilities:    │
│                  │     │   predicate)    │     │  tabStripPosition │
│                  │     │                │     │  maxPanes         │
│  + User Override │     │  Configurable  │     │  dockStrategy     │
│    (bypass)      │     │  per tenant    │     │  [extensible...]  │
└─────────────────┘     └────────────────┘     └───────────────────┘
                                                        │
                                                        ▼
                                               Published as facts
                                               in predicate system
                                               + CSS data attribute
                                               + CSS custom property
```

### Signals

```typescript
/** Raw device/viewport signals sampled from the environment. */
interface LayoutSignals {
  /** Viewport dimensions in CSS pixels. */
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Primary pointer type — from matchMedia('(pointer: coarse|fine)'). */
  readonly pointer: "coarse" | "fine" | "none";
  /** Primary hover capability — from matchMedia('(hover: hover|none)'). */
  readonly hover: "hover" | "none";
  /** True if ANY input device is fine (critical for desktop + touchscreen). */
  readonly anyPointerFine: boolean;
  /** True if ANY input device can hover. */
  readonly anyHoverHover: boolean;
  /** Orientation derived from viewport aspect ratio (not device API). */
  readonly orientation: "portrait" | "landscape";
  /** PWA standalone mode — from matchMedia('(display-mode: standalone)'). */
  readonly standalone: boolean;
  /** Device pixel ratio. */
  readonly devicePixelRatio: number;
}
```

**Design rationale:**
- No user-agent sniffing. All signals are capability-based via `matchMedia` and viewport measurement.
- `anyPointerFine` / `anyHoverHover` are critical for the "desktop with touchscreen" scenario — primary pointer may be `coarse` but a fine pointer exists, so the device should NOT be treated as a phone.
- Orientation is derived from aspect ratio, not the Orientation API, because the Orientation API is unreliable in desktop browsers and split-screen iPad.

### Rules Engine

Rules are ordered predicates evaluated by `@weaver/predicate` (the existing MongoDB-style query engine). **First match wins.**

```typescript
interface LayoutRule {
  /** Human-readable name for debugging and config UI. */
  readonly name: string;
  /** MongoDB-style predicate over LayoutSignals. */
  readonly when: Record<string, unknown>;
  /** The mode to resolve to if this rule matches. */
  readonly mode: string;
}

type LayoutRuleset = readonly LayoutRule[];
```

**Default rules:**

```typescript
const DEFAULT_LAYOUT_RULES: LayoutRuleset = [
  // Narrow viewport → compact (phones, very small windows, iPad split-screen half)
  {
    name: "narrow-viewport",
    when: { viewportWidth: { $lt: 600 } },
    mode: "compact",
  },
  // Short + touch-only → compact (phone in landscape: wide but too short for sidebar)
  {
    name: "short-touch-viewport",
    when: {
      viewportHeight: { $lt: 500 },
      anyPointerFine: { $eq: false },
    },
    mode: "compact",
  },
  // Medium + touch-only below 768 → compact (large phone in landscape, touch-only)
  {
    name: "medium-touch-only",
    when: {
      viewportWidth: { $gte: 600, $lt: 768 },
      anyPointerFine: { $eq: false },
    },
    mode: "compact",
  },
  // Medium viewport → medium (tablets, small desktop windows)
  {
    name: "medium-viewport",
    when: { viewportWidth: { $gte: 600, $lt: 1024 } },
    mode: "medium",
  },
  // Wide + pure touch, no hover → medium (iPad landscape: width but no mouse precision)
  {
    name: "wide-touch-only",
    when: {
      viewportWidth: { $gte: 1024 },
      anyPointerFine: { $eq: false },
      anyHoverHover: { $eq: false },
    },
    mode: "medium",
  },
  // Wide viewport → expanded (desktop browsers, touch laptops with trackpads)
  {
    name: "wide-viewport",
    when: { viewportWidth: { $gte: 1024 } },
    mode: "expanded",
  },
];
```

**Scenario validation:**

| Scenario | Width | Height | anyPointerFine | anyHoverHover | Rule Match | Mode |
|---|---|---|---|---|---|---|
| Phone portrait | 390 | 844 | false | false | narrow-viewport | **compact** |
| Phone landscape | 844 | 390 | false | false | short-touch-viewport | **compact** |
| iPad portrait | 810 | 1080 | false | false | medium-viewport | **medium** |
| iPad landscape | 1080 | 810 | false | false | wide-touch-only | **medium** |
| iPad split-screen half | 507 | 1080 | false | false | narrow-viewport | **compact** |
| Desktop at 800px | 800 | 900 | true | true | medium-viewport | **medium** |
| Desktop at 400px | 400 | 900 | true | true | narrow-viewport | **compact** |
| Desktop touch laptop | 1440 | 900 | true | true | wide-viewport | **expanded** |
| Foldable unfolded | 884 | 1080 | false | false | medium-viewport | **medium** |

### Modes and Capabilities

A mode is a **named bundle of capabilities**. Three standard modes are provided; tenants can add or modify modes.

```typescript
/** A mode definition — maps a name to a set of capabilities. */
interface ModeDefinition {
  /** Well-known core capabilities. */
  tabStripPosition: "top" | "bottom";
  maxPanes: number;
  dockStrategy: PlacementStrategyId;
  /** Extensible — arbitrary key-value pairs for plugin-specific capabilities. */
  [key: string]: unknown;
}
```

**Standard mode definitions:**

```typescript
const STANDARD_MODES: Record<string, ModeDefinition> = {
  compact: {
    tabStripPosition: "bottom",
    maxPanes: 1,
    dockStrategy: "stack",
  },
  medium: {
    tabStripPosition: "bottom",
    maxPanes: 2,
    dockStrategy: "stack",
  },
  expanded: {
    tabStripPosition: "top",
    maxPanes: Infinity,
    dockStrategy: "dwindle",   // or workspace's configured strategy
  },
};
```

**Why modes carry capabilities instead of being contracts:**

- Plugins check capabilities, not mode names: `when: { "layout.tabStripPosition": "bottom" }` not `when: { "layout.mode": "compact" }` (though mode name is also available as a shorthand).
- Adding a 4th mode (e.g., tenant-defined "kiosk") requires only defining its capabilities — all existing capability-based `when` clauses still work.
- Capabilities are the API; mode names are organizational.

### Tenant Configurability

Tenants can customize:
1. **Rules** — replace or extend the default ruleset with custom rules (e.g., add a "kiosk" rule for standalone + touch-only devices).
2. **Mode definitions** — add custom modes or override capability values for standard modes.
3. **Breakpoints** — adjust the pixel thresholds in rules.

Tenants **cannot** modify the signal collection (signals come from the environment).

### User Override

```typescript
interface LayoutOverride {
  readonly mode: string | null;  // force a specific mode, or null for auto
}
```

Stored in user settings. When set, the rules engine is bypassed entirely. Handles "always use desktop mode on my iPad."

### Hysteresis & Reactivity

- **Debounce**: 150ms window for signal changes (covers rapid resize events).
- **Hysteresis**: ±32px dead zone at mode boundaries. Mode won't change unless viewport crosses the threshold ± hysteresis from the opposite direction. Prevents flickering when dragging a window edge across a breakpoint.
- **Signal sampling**: `matchMedia` listeners for pointer/hover/display-mode (event-driven, no polling). `ResizeObserver` on shell root for viewport dimensions.

### Fallback

If no rule matches, the fallback mode is **"expanded"** — the safest default, providing full desktop capability.

### API Surface

```typescript
// Via GhostApi
interface LayoutService {
  /** Current resolved mode name. */
  readonly mode: string;
  /** Current mode's capabilities. */
  readonly capabilities: Readonly<ModeDefinition>;
  /** Current raw signals (readonly snapshot). */
  readonly signals: Readonly<LayoutSignals>;
  /** Whether user has a manual override active. */
  readonly isOverridden: boolean;
  /** Fires when mode changes (after debounce + hysteresis). */
  readonly onDidChangeMode: Event<string>;
  /** Fires when any signal changes (debounced). */
  readonly onDidChangeSignals: Event<Readonly<LayoutSignals>>;
}
```

**Context facts for predicate system:**

| Fact Key | Type | Example | Source |
|---|---|---|---|
| `layout.mode` | `string` | `"compact"` | Resolved mode name |
| `layout.tabStripPosition` | `string` | `"bottom"` | Mode capability |
| `layout.maxPanes` | `number` | `1` | Mode capability |
| `layout.dockStrategy` | `string` | `"stack"` | Mode capability |
| `layout.pointer` | `string` | `"coarse"` | Raw signal |
| `layout.hover` | `string` | `"none"` | Raw signal |
| `layout.orientation` | `string` | `"portrait"` | Raw signal |
| `layout.standalone` | `boolean` | `true` | Raw signal |

All queryable via `when` predicates:

```typescript
when: { "layout.tabStripPosition": "bottom" }          // capability check
when: { "layout.maxPanes": { "$gt": 1 } }              // capability check
when: { "layout.mode": "compact" }                      // mode shorthand
when: { "layout.pointer": "coarse" }                    // raw signal check
```

**DOM attributes:**

```html
<html data-ghost-layout="compact" style="--ghost-layout-mode: compact">
```

Both `data-ghost-layout` (for clean CSS selectors) and `--ghost-layout-mode` (for programmatic CSS reads) are set on `<html>`.

### Extension: `when` on PluginSlotContribution

Add optional `when?: PluginContributionPredicate` to `PluginSlotContribution` (currently only layer surfaces have `when`). This allows edge slot contributions to be conditional on layout capabilities:

```typescript
// Show only when tab strip is at top (expanded mode)
contributes: {
  slots: [{
    id: "topbar-title",
    slot: "top",
    position: "center",
    component: "topbar-title",
    when: { "layout.tabStripPosition": "top" },
  }]
}
```

## 2) PlacementHint Simplification

### Current Hints (6)

```typescript
type PlacementHint = "tab" | "tab-background" | "replace" | "split" | "window" | "auto";
```

### Problem

`tab` and `tab-background` assume the layout has a tab strip. `window` assumes multi-window support. These are layout-specific concepts, not navigation intents.

### New Hints (5)

```typescript
type PlacementHint =
  | "auto"        // Navigate. Layout engine decides where.
  | "replace"     // Navigate in-place. Current content swaps. No new surface.
  | "split"       // Hint: I want side-by-side. Engine may degrade.
  | "background"  // Hint: open without taking focus.
  | "detach"      // Hint: pop to own window. Degrades to auto on compact.
```

### Why Both `auto` and `replace`

These are the two fundamental navigation primitives:

- **`auto` (push)**: New view appears, previous view goes to navHistory. Back button returns to previous view. Used for "go deeper" — e.g., list → detail → sub-detail.
- **`replace`**: Current view's content/args swap in place. No navHistory change. Used for "update current view" — e.g., changing filters, switching sub-tabs within a view. Without `replace`, every filter change would pollute the back stack.

### Resolution Per Mode Capabilities

| Hint | `maxPanes: Infinity` (expanded) | `maxPanes: 2` (medium) | `maxPanes: 1` (compact) |
|---|---|---|---|
| `auto` | New tab in active stack | Push onto active stack | Push onto stack |
| `replace` | Replace active tab args | Replace current view args | Replace current view args |
| `split` | Create adjacent split pane | Side-by-side if panes < max, else push | Push (degrade gracefully) |
| `background` | Open tab without activating | Open without activating | Toast notification ("Opened X") |
| `detach` | Pop-out window | Full-screen overlay | Auto (degrade) |

Resolution is driven by capabilities (especially `maxPanes`), not mode names.

### Migration

| Old Hint | New Hint | Notes |
|---|---|---|
| `tab` | `auto` | Layout engine decides tab vs stack push |
| `tab-background` | `background` | Intent is "don't focus," not "create a tab" |
| `replace` | `replace` | Unchanged |
| `split` | `split` | Unchanged |
| `window` | `detach` | Clearer name, graceful degradation |
| `auto` | `auto` | Unchanged |

## 3) Compact Dock Renderer

A new renderer that produces compact-optimized DOM from the same dock tree data.

### Core Behavior: Flatten All Tabs

The compact renderer **traverses the entire dock tree** and collects all tabs from every `DockStackNode` leaf in the workspace, regardless of tree depth or split nesting.

```
Desktop dock tree:
  DockSplitNode {
    first: DockStackNode { tabIds: [Tasks, Search], activeTabId: Tasks }
    second: DockSplitNode {
      first: DockStackNode { tabIds: [WO-42, WO-43], activeTabId: WO-42 }
      second: DockStackNode { tabIds: [Map], activeTabId: Map }
    }
  }

Compact renderer output:

┌──────────────────────────────┐
│  ← Back   WO-42 Detail   ⋯  │  ← Compact header (contextual)
│                              │
│                              │
│     WO-42 Detail Content     │  ← Full-screen: workspace's active tab
│     (active tab from any     │
│      stack in the tree)      │
│                              │
├──────────────────────────────┤
│ 📋  🔍  📄  📄  🗺️         │  ← Bottom bar: ALL tabs from ALL stacks
│Tasks Srch WO42 WO43 Map     │     (scrollable if > ~5)
└──────────────────────────────┘
```

The bottom bar is literally the **tab strip relocated to the bottom** — same data (`tabIds` from every stack), different rendering position and style.

### Tree Traversal

```typescript
/** Collect all tabs from all stacks in the dock tree. */
function collectAllTabs(node: DockNode): TabInfo[] {
  if (node.kind === "stack") {
    return node.tabIds.map(id => ({ id, stackId: node.id }));
  }
  // Split node: recurse into both branches
  return [
    ...collectAllTabs(node.first),
    ...collectAllTabs(node.second),
  ];
}
```

The collected tabs are rendered in tree-traversal order (left-to-right, depth-first). The workspace's globally active tab is highlighted in the bottom bar and shown full-screen.

### Compact Header

The top area shows a contextual header:
- **Back button** (when navHistory has entries — shell.stack.navigate.back)
- **Active view title** (from the active tab's `ContextTab.label`)
- **Overflow actions** (⋯ menu with contextual actions for the active part)

### Resize Behavior

```
Expanded (>1024px):                   Compact (≤600px):
┌──────┬──────────┬─────────┐        ┌──────────────────────┐
│ Tasks│ WO-42    │ Map     │        │ ← Back  WO-42     ⋯  │
│ List │ Detail   │ View    │  ←→    │                      │
└──────┴──────────┴─────────┘        │  WO-42 Detail        │
                                     ├──────────────────────┤
                                     │ 📋 🔍 📄 📄 🗺️      │
                                     └──────────────────────┘
```

**The dock tree data is NEVER mutated on resize.** The compact renderer ignores the spatial arrangement (splits, ratios) and shows all tabs flat. Resizing back to expanded restores the exact split layout instantly because the tree structure was preserved.

### Overflow Handling

When the workspace has many open tabs (>5), the bottom bar provides:
- Horizontal scroll for tab overflow
- Or a "more" affordance showing the full list as a bottom sheet

The exact overflow pattern is a rendering/UX detail, not architectural.

### DOM Preservation Within a Stack

Within a single `DockStackNode`, inactive tabs get `display: none` — DOM stays alive. This preserves scroll position, form input state, and component local state when switching between tabs in the same stack. The compact renderer inherits this behavior.

## 4) Placement Strategy on Compact

When the resolved mode's `dockStrategy` capability is `"stack"`, the shell forces the `stack` placement strategy for all new tab operations:

- `auto` hint → pushes onto the active stack with `navHistory` tracking
- `replace` hint → updates active tab's `args` in place (no navHistory change)
- `split` hint → degrades to push (since `maxPanes: 1`)
- `background` hint → creates tab without activating (visible in bottom bar but not focused)
- `detach` hint → degrades to auto

The existing `stack` placement strategy code handles all of this. The only new behavior is **forcing** the strategy based on mode capability rather than user/workspace config.

## 5) Navigation Target Resolution

### Current Architecture (Unchanged)

```
navigate({ intent: "workorder.open", facts: { id: "42" } })
  → Intent resolution (packages/intents/)
  → Resolves to part definition + args
  → NavigationDelegate.openTab()
  → Active placement strategy decides where in the dock tree
```

### V1: No Cross-Context Routing

All navigation opens in the **current stack** (whatever stack is active in the dock tree). On compact mode, this means content appears in the one visible stack. Users switch between tabs manually via the bottom bar.

This is the existing behavior — no changes to the navigation pipeline. The compact renderer just presents the result differently.

### Design Principle

> Navigation target resolution is decoupled from rendering and layout mode. The resolution pipeline (intent → part definition → tab placement) remains unchanged across all modes. This allows the resolution system and the layout system to evolve independently.

### Future Considerations (Deferred)

- **Navigation destinations**: A formal contribution model for primary navigation entry points (bottom bar items, activity bar items). Would replace the "all tabs from tree" approach with curated destinations.
- **Per-destination stacks**: Each destination owns an independent navigation stack with its own navHistory. Would enable "preserve depth when switching destinations."
- **Cross-destination routing**: When an intent resolves to content "owned" by another destination, auto-switch. Requires an ownership model.
- **Part pin/reuse policy**: Allow parts to declare `reusePolicy: "pin"` to reuse existing instances instead of creating new tabs.
- **Destination hint**: Optional `destination` field on `NavigationHints` for explicit cross-destination targeting.

## Alternatives Considered

### A: Form-Factor-Specific Dock Tree Types

Add mobile-specific node types (`MobileNavigatorNode`, `MobileStackNode`) to the dock tree.

- **Pro**: Could model mobile navigation more precisely.
- **Con**: Violates unified data model. Desktop code would need to handle or ignore mobile types. More types to maintain. Breaks the "same data, different renderer" principle.
- **Decision**: Rejected. Reuse existing dock tree types. The compact renderer presents them differently.

### B: Separate Mobile App

Build a separate mobile application consuming the same APIs/services.

- **Pro**: Full control over mobile UX without desktop constraints.
- **Con**: Duplicated effort, divergent feature sets, two codebases to maintain, double the plugin surface area.
- **Decision**: Rejected. Adaptive rendering of a single codebase is more sustainable.

### C: CSS-Only Responsive (No Mode Service)

Use media queries and container queries exclusively, no JavaScript mode service.

- **Pro**: Simpler, no new runtime code.
- **Con**: Cannot drive structural decisions (which placement strategy, which renderer, which contributions are visible). CSS can't change the dock tree rendering pipeline or force a placement strategy.
- **Decision**: Rejected. CSS handles within-component adaptation (via container queries); the mode service handles structural decisions. Both are needed.

### D: Fixed Pixel Breakpoints (No Rules Engine)

Use hardcoded pixel thresholds without considering device capabilities.

- **Pro**: Simpler implementation.
- **Con**: A 1080px iPad in landscape and a 1080px desktop with a mouse are fundamentally different. Pixel-only breakpoints cannot distinguish them. The `pointer` and `hover` signals are essential for correct mode resolution.
- **Decision**: Rejected. Rule-based resolution with capability signals produces correct results across all device types.

### E: Modes as Fixed Contracts

Define modes as a fixed enum that plugins code against directly.

- **Pro**: Simple mental model.
- **Con**: Adding a 4th mode requires all plugins to handle it. Tenants cannot define custom modes. Plugins check mode names instead of capabilities, coupling them to the mode system.
- **Decision**: Rejected. Modes carry capabilities. Plugins check capabilities. Mode names are organizational, not contractual.

### F: Navigation Destinations in V1

Build the full destination contribution model, per-destination stacks, and tenant/user configuration now.

- **Pro**: Full mobile navigation experience from day one.
- **Con**: The destination concept is not yet well-defined across both desktop and mobile. Premature formalization risks building the wrong abstraction. The responsive infrastructure (mode service, compact renderer) is valuable independently and validates the approach.
- **Decision**: Deferred. V1 uses the flattened tab strip as the bottom bar. Destinations will be designed when the concept is clearer across all form factors.

## Consequences

### Positive

- **Unified codebase**: One shell, one set of plugins, all form factors. No separate mobile app.
- **Minimal new abstractions**: The dock tree, placement strategies, `when` predicates, and menu contributions serve all modes. The compact renderer and mode service are the only net-new components.
- **Desktop benefits immediately**: The Layout Mode Service enables responsive desktop features (topbar overflow via `when`, edge slot visibility, contribution filtering) even before mobile-specific work.
- **Capability-based extensibility**: Tenants can define custom modes with custom capabilities. Plugins can publish and query arbitrary capability keys. The system grows organically.
- **Low-risk v1**: The bottom bar is just the tab strip rendered differently — no new data model, no new state management. If the approach doesn't work, the compact renderer can be replaced without touching the core.
- **PlacementHint simplification**: Cleaner, intent-based API that degrades gracefully across all modes.

### Negative / Tradeoffs

- **Compact renderer is new code**: Must be built and maintained alongside the desktop renderer. Two rendering paths means two sets of layout bugs to track.
- **Flat bottom bar is basic**: V1 bottom bar shows all open tabs — not curated navigation destinations. Users see whatever they have open, not a designed mobile navigation experience. Adequate for responsive desktop, less polished for dedicated mobile use.
- **Stack strategy is forced**: In compact mode, users lose the ability to create splits. This is intentional (splits don't work on small screens) but limits power-user workflows on tablets.
- **No per-destination state isolation**: V1 has one shared dock tree. Switching "tabs" in the bottom bar doesn't preserve per-tab navigation depth. This is a known limitation addressed by the deferred destinations work.

### Risks

- **Plugin responsiveness**: Plugins designed for wide viewports may render poorly at compact widths. Mitigation: container queries (already supported), `when` predicates for contribution visibility, documentation for plugin authors.
- **PlacementHint migration**: Changing from 6 to 5 hints requires updating existing callers. Mitigation: small, internal codebase — mechanical find-and-replace.
- **Rule complexity**: Tenant-custom rules could produce unexpected mode resolution. Mitigation: fallback to "expanded" when no rule matches (safe default), debugging via rule name logging.
- **Hysteresis tuning**: ±32px dead zone is an estimate. May need adjustment based on real-world resize behavior. Mitigation: configurable via `LayoutResolutionConfig`.

## Open Questions

1. **Navigation destinations**: What exactly is a "destination" across both desktop and mobile? How do plugins contribute them? How does tenant/user configuration work? This is the primary design question for the next phase.
2. **Per-destination stacks**: How does within-destination push/pop navigation work alongside the shared dock tree? Is each destination its own DockStackNode, or is there a lighter abstraction?
3. **Part linking / data providers**: How do master and detail parts communicate? A master part provides a filtered entity list that a detail part consumes. Deferred to separate investigation.
4. **Scroll restoration**: The router currently has no scroll position tracking. This is critical for mobile back navigation UX. Should be addressed as a router enhancement.
5. **View transitions**: Stack push/pop on mobile should animate. How does this integrate with the compact renderer? CSS View Transitions API?
6. **Non-active leaf access**: When the compact renderer flattens the tree, all tabs are in the bottom bar. But with many tabs, discoverability suffers. Should there be a dedicated "open tabs" view?
7. **Desktop activity bar**: How should `navigation.primary` contributions render on desktop? Activity bar? Top bar section? This is part of the destinations design.
8. **Offline shell support**: Service worker for asset caching, plugin remote caching, offline navigation. Separate investigation.

## Related

- **armada-cygf**: Epic — Responsive layout and overlay infrastructure
- **armada-3bq1**: Layout Mode Service (superseded by this ADR's mode resolution design, but same epic)
- **armada-k3cs**: Generic drawer/sheet mechanism
- **armada-2ovz**: Topbar slot overflow handling
- `docs/architecture/adr-layer-system.md`: Layer system ADR (surface visibility, when-conditions)
- `docs/architecture/concepts/state-management.md`: Dock tree and state concepts
- `packages/state/src/placement-strategy/stack.ts`: Existing stack strategy with navHistory
- `packages/state/src/dock-tree-types.ts`: DockSplitNode, DockStackNode types
- `packages/router/src/core/types.ts`: PlacementHint, NavigationTarget definitions
- `packages/plugin-contracts/src/types.ts`: PluginMenuContribution, PluginSlotContribution
- `packages/layer/src/registry.ts`: When-condition evaluation on layer surfaces
