import type { LayerRegistry } from "@ghost-shell/layer";
import { DEFAULT_DARK_PALETTE, injectThemeVariables } from "@ghost-shell/theme";
import type { ShellRuntime } from "../app/types.js";

/** CSS rules shared between main window and popout mounts. */
function getSharedStyles(): string {
  return `
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body { margin: 0; background: transparent; color: var(--ghost-foreground); }
    * { scrollbar-width: thin; scrollbar-color: var(--ghost-muted-foreground) transparent; }
    .card { border: 1px solid var(--ghost-border-alt); border-radius: 4px; margin-bottom: 6px; padding: 6px; }
    .part-root { border: 1px solid var(--ghost-border-alt); border-radius: 4px; margin-bottom: 0; padding: 6px; container-type: inline-size; display: flex; flex-direction: column; min-height: 0; height: 100%; }
    .part-root h2 { margin: 0 0 6px; font-size: 14px; }
    .part-root.is-selected { border-color: var(--ghost-primary); box-shadow: 0 0 0 1px var(--ghost-primary-glow-subtle) inset; }
    .part-actions { display: flex; gap: 6px; margin-bottom: 6px; }
    .part-actions button { background: var(--ghost-surface-elevated); border: 1px solid var(--ghost-border); border-radius: 3px; color: var(--ghost-foreground); padding: 3px 7px; cursor: pointer; }
    .bridge-warning { border-left: 3px solid var(--ghost-warning); padding: 6px 8px; background: var(--ghost-warning-background); color: var(--ghost-warning-foreground); margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); }
    .runtime-note { color: var(--ghost-muted-foreground); font-size: 12px; margin: 0; }
    .dev-inspector { border-color: var(--ghost-border-accent); background: var(--ghost-surface-inset); }
    .dev-inspector details { margin-bottom: 6px; }
    .dev-inspector pre { margin: 6px 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 4px; border: 1px solid var(--ghost-border); background: var(--ghost-surface-inset-deep); color: var(--ghost-code-foreground); font-size: 11px; }
    .dev-inspector ul { margin: 6px 0; padding-left: 18px; }
    .dev-inspector li { margin: 3px 0; }
    .domain-panel { display: grid; gap: 6px; grid-template-rows: minmax(0, 1fr) auto; min-width: 0; min-height: 0; flex: 1 1 auto; }
    .domain-panel-host,
    .domain-panel-fallback { min-width: 0; min-height: 0; overflow: auto; }
    .domain-hint { margin: 0; color: var(--ghost-dim-foreground); font-size: 12px; }
    .domain-list { display: grid; gap: 4px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid var(--ghost-border); background: var(--ghost-surface-hover); color: var(--ghost-foreground); border-radius: 4px; padding: 6px; cursor: pointer; }
    .domain-row:hover { border-color: var(--ghost-primary); }
    .domain-row.is-selected { border-color: var(--ghost-primary); box-shadow: 0 0 0 1px var(--ghost-primary-glow) inset; }
    .intent-chooser { margin-top: 6px; border: 1px solid var(--ghost-border); border-radius: 4px; padding: 6px; background: var(--ghost-surface-overlay); }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 3px 0; background: var(--ghost-surface-elevated); border: 1px solid var(--ghost-border); border-radius: 3px; color: var(--ghost-foreground); padding: 5px; cursor: pointer; }
    .intent-chooser button:hover { border-color: var(--ghost-primary); }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }`;
}

type MountDeps = {
  renderParts: () => void;
  updateWindowReadOnlyState: () => void;
  setupResize: () => () => void;
  publishRestoreRequestOnUnload: () => void;
  layerRegistry: LayerRegistry;
};

let _layerRegistry: LayerRegistry | undefined;

/** Returns the LayerRegistry created during mountMainWindow, or undefined if not yet mounted. */
export function getLayerRegistry(): LayerRegistry | undefined {
  return _layerRegistry;
}

export function mountMainWindow(root: HTMLElement, deps: MountDeps): () => void {
  injectThemeVariables(DEFAULT_DARK_PALETTE);

  const layerRegistry = deps.layerRegistry;
  _layerRegistry = layerRegistry;

  root.innerHTML = `
  <style>
    ${getSharedStyles()}
    :root { --ghost-edge-bottom-min-height: 24px; --ghost-edge-left-min-width: auto; --ghost-edge-right-min-width: auto; }
    .part-actions button:hover { border-color: var(--ghost-primary); }
    #layer-host { position: relative; width: 100%; height: 100%; }
    .shell-layer { position: absolute; inset: 0; pointer-events: none; isolation: isolate; }
    .shell-layer[data-layer="main"] { pointer-events: auto; top: var(--exclusive-top, 0px); right: var(--exclusive-right, 0px); bottom: var(--exclusive-bottom, 0px); left: var(--exclusive-left, 0px); }
    .shell-layer .layer-surface { pointer-events: auto; }
    .shell { display: grid; grid-template-areas: 'top top top' 'left main right' 'bottom bottom bottom'; grid-template-rows: auto 1fr auto; grid-template-columns: auto 1fr auto; width: 100%; height: 100%; overflow: hidden; }
    .edge-slot { display: flex; overflow: hidden; }
    .edge-slot-top { grid-area: top; flex-direction: row; min-height: var(--ghost-edge-top-min-height, 36px); background: var(--ghost-edge-top); color: var(--ghost-edge-top-foreground); border-bottom: 1px solid var(--ghost-edge-top-border); padding: 0 8px; align-items: center; }
    .edge-slot-bottom { grid-area: bottom; flex-direction: row; min-height: var(--ghost-edge-bottom-min-height, 24px); background: var(--ghost-edge-bottom); color: var(--ghost-edge-bottom-foreground); border-top: 1px solid var(--ghost-edge-bottom-border); padding: 0 8px; align-items: center; }
    .edge-slot-left { grid-area: left; flex-direction: column; min-width: var(--ghost-edge-left-min-width, auto); background: var(--ghost-edge-left); color: var(--ghost-edge-left-foreground); border-right: 1px solid var(--ghost-edge-left-border); padding: 4px 0; align-items: center; }
    .edge-slot-right { grid-area: right; flex-direction: column; min-width: var(--ghost-edge-right-min-width, auto); background: var(--ghost-edge-right); color: var(--ghost-edge-right-foreground); border-left: 1px solid var(--ghost-edge-right-border); padding: 4px 0; align-items: center; }
    .edge-slot-start, .edge-slot-center, .edge-slot-end { display: flex; align-items: center; }
    .edge-slot-start { flex: 1; justify-content: flex-start; min-width: 0; overflow: hidden; }
    .edge-slot-center { flex: 1; justify-content: center; }
    .edge-slot-end { flex: 1; justify-content: flex-end; min-width: 0; overflow: hidden; }
    .dock-root { grid-area: main; }
    .shell,
    .shell > .dock-root,
    .dock-root > .dock-node,
    .dock-split-branch > .dock-node,
    .dock-node-split,
    .dock-node-stack,
    .dock-stack-panels { height: 100%; }
    .dock-root { background: transparent; min-width: 0; min-height: 0; overflow: hidden; padding: var(--dock-panel-gap, 6px); display: flex; flex-direction: column; }
    .dock-root > .dock-node { flex: 1 1 auto; }
    .dock-node { min-width: 0; min-height: 0; }
    .dock-node-stack { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; border: 1px solid var(--ghost-border-muted); border-radius: var(--dock-panel-radius, 6px); background: color-mix(in srgb, var(--ghost-surface) calc(var(--ghost-opacity-inactive, 0.9) * 100%), transparent); overflow: hidden; }
    .dock-node-stack[data-single-tab="true"] .part-tab-strip { display: none; }
    .dock-node-stack[data-single-tab="true"] { grid-template-rows: minmax(0, 1fr); }
    .dock-node-stack:focus-within { background: color-mix(in srgb, var(--ghost-surface) calc(var(--ghost-opacity-active, 1) * 100%), transparent); border-color: var(--ghost-primary); box-shadow: 0 0 0 1px var(--ghost-primary-glow-subtle); }
    .dock-node-stack.is-active-stack { background: color-mix(in srgb, var(--ghost-surface) calc(var(--ghost-opacity-active, 1) * 100%), transparent); border-color: var(--ghost-primary); box-shadow: 0 0 0 1px var(--ghost-primary-glow-subtle); }
    .dock-stack-panels { min-height: 0; overflow: hidden; padding: 0; position: relative; display: flex; flex-direction: column; }
    .dock-stack-panels > [role="tabpanel"] { min-width: 0; min-height: 0; height: 100%; overflow: hidden; flex: 1 1 auto; display: flex; flex-direction: column; }
    .dock-stack-panels > [role="tabpanel"][hidden] { display: none; }
    .dock-tabpanel { min-width: 0; min-height: 0; overflow: hidden; flex: 1 1 auto; display: flex; }
    .dock-tabpanel-content { min-width: 0; min-height: 0; width: 100%; height: 100%; max-width: 100%; max-height: 100%; overflow: auto; flex: 1 1 auto; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; }
    .dock-tabpanel-content > * { min-width: 0; }
    .dock-node-split { --dock-splitter-size: 12px; display: grid; gap: 0; min-width: 0; min-height: 0; }
    .dock-node-split-horizontal { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .dock-node-split-vertical { grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
    .dock-split-branch { min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
    .dock-splitter { position: relative; background: transparent; user-select: none; touch-action: none; z-index: 2; }
    .dock-splitter::before { content: ""; position: absolute; background: var(--ghost-border-muted); pointer-events: none; }
    .dock-splitter-horizontal { cursor: col-resize; }
    .dock-splitter-horizontal::before { top: 0; bottom: 0; left: 50%; width: 1px; transform: translateX(-0.5px); }
    .dock-splitter-vertical { cursor: row-resize; }
    .dock-splitter-vertical::before { left: 0; right: 0; top: 50%; height: 1px; transform: translateY(-0.5px); }
    .dock-splitter:hover::before { background: var(--ghost-primary); }
    .is-dock-splitter-dragging { cursor: grabbing; }
    .is-dock-splitter-dragging .dock-splitter-horizontal { cursor: col-resize; }
    .is-dock-splitter-dragging .dock-splitter-vertical { cursor: row-resize; }
    .part-tab-strip { display: flex; gap: 2px; align-items: center; overflow-x: auto; scrollbar-width: thin; padding: 2px; }
    .part-tab-item { display: inline-flex; align-items: center; gap: 2px; position: relative; }
    .part-tab { appearance: none; background: transparent; border: 1px solid transparent; border-bottom: none; color: var(--ghost-muted-foreground); padding: 5px 7px; border-radius: 4px 4px 0 0; cursor: grab; white-space: nowrap; }
    .part-tab:hover { background: var(--ghost-surface-hover); color: var(--ghost-foreground); }
    .part-tab:active { cursor: grabbing; }
    .part-tab:focus-visible { outline: 2px solid var(--ghost-primary); outline-offset: 1px; }
    .part-tab.is-active { background: color-mix(in srgb, var(--ghost-surface-elevated) calc(var(--ghost-opacity-active, 1) * 100%), transparent); border-color: var(--ghost-border); color: var(--ghost-foreground-bright); }
    .part-tab-close { appearance: none; background: transparent; border: 1px solid transparent; color: var(--ghost-faint-foreground); border-radius: 3px; cursor: pointer; width: 18px; height: 18px; line-height: 1; padding: 0; }
    .part-tab-close:hover { background: var(--ghost-surface-hover); color: var(--ghost-foreground-bright); border-color: var(--ghost-border); }
    .part-tab-close:focus-visible { outline: 2px solid var(--ghost-primary); outline-offset: 1px; }
    .splitter { background: var(--ghost-border-muted); cursor: col-resize; user-select: none; touch-action: none; }
    .splitter[data-pane="secondary"] { cursor: row-resize; }
    .plugin-row { display:block; margin: 6px 0; }
    .plugin-activate-btn { margin-left: 8px; padding: 2px 8px; font-size: 11px; cursor: pointer; }
    .plugin-error { margin: 4px 0 0 22px; color: var(--ghost-error-foreground-muted); font-size: 12px; }
    .plugin-notice { margin:0 0 8px; font-size:12px; color: var(--ghost-warning-foreground); }
    .plugin-diag-list { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: var(--ghost-muted-foreground); }
    .plugin-diag-list li { margin: 2px 0; }
    .dock-drop-overlay { display: none; position: absolute; inset: 4px; z-index: 8; border-radius: 6px; pointer-events: none; }
    .is-dock-dragging .dock-drop-overlay { display: block; }
    .dock-drop-zone { position: absolute; border: 0; border-radius: 6px; background: transparent; pointer-events: auto; }
    .dock-drop-zone-left { left: 0; top: 0; width: 20%; height: 100%; }
    .dock-drop-zone-right { right: 0; top: 0; width: 20%; height: 100%; }
    .dock-drop-zone-top { left: 20%; top: 0; width: 60%; height: 20%; }
    .dock-drop-zone-bottom { left: 20%; bottom: 0; width: 60%; height: 20%; }
    .dock-drop-zone-center { left: 28%; top: 28%; width: 44%; height: 44%; }
    .dock-drop-preview { display: none; position: absolute; inset: 0; border-radius: 6px; background: transparent; pointer-events: none; }
    .dock-drop-overlay[class*="is-preview-"] .dock-drop-preview { display: block; }
    .dock-drop-overlay.is-preview-left .dock-drop-preview { left: 0; top: 0; right: auto; bottom: 0; width: 50%; background: var(--ghost-primary-overlay); }
    .dock-drop-overlay.is-preview-right .dock-drop-preview { left: auto; top: 0; right: 0; bottom: 0; width: 50%; background: var(--ghost-primary-overlay); }
    .dock-drop-overlay.is-preview-top .dock-drop-preview { left: 0; top: 0; right: 0; bottom: auto; height: 50%; background: var(--ghost-primary-overlay); }
    .dock-drop-overlay.is-preview-bottom .dock-drop-preview { left: 0; top: auto; right: 0; bottom: 0; height: 50%; background: var(--ghost-primary-overlay); }
    .dock-drop-overlay.is-preview-center .dock-drop-preview { inset: 8%; background: var(--ghost-primary-overlay); border: 1px solid var(--ghost-primary-border-semi); }
  </style>
  <div id="layer-host">
    <div class="shell-layer" data-layer="background" data-z="0" style="z-index:0" role="presentation"></div>
    <div class="shell-layer" data-layer="bottom" data-z="100" style="z-index:100" role="presentation"></div>
    <main class="shell shell-layer" id="shell-root" data-layer="main" data-z="200" style="z-index:200">
      <section class="edge-slot edge-slot-top"></section>
      <section class="edge-slot edge-slot-left"></section>
      <section class="dock-root" id="dock-tree-root" data-slot="main"></section>
      <section class="edge-slot edge-slot-right"></section>
      <section class="edge-slot edge-slot-bottom"></section>
    </main>
    <div class="shell-layer" data-layer="floating" data-z="300" style="z-index:300" role="presentation"></div>
    <div class="shell-layer" data-layer="notification" data-z="400" style="z-index:400" role="presentation"></div>
    <div class="shell-layer" data-layer="modal" data-z="500" style="z-index:500" role="dialog"></div>
    <div class="shell-layer" data-layer="overlay" data-z="600" style="z-index:600" role="presentation"></div>
  </div>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  // Wire layer host so plugin-registered layers get DOM containers
  const layerHostEl = root.querySelector<HTMLElement>("#layer-host");
  if (layerHostEl) {
    layerRegistry.setLayerHost(layerHostEl);
  }

  deps.renderParts();
  deps.updateWindowReadOnlyState();
  const disposeResize = deps.setupResize();

  // Ensure shell keybindings are active from first load.
  // tabindex="-1" makes the root programmatically focusable (not in tab order).
  root.setAttribute("tabindex", "-1");
  root.focus();

  return () => {
    disposeResize();
  };
}

export function mountPopout(root: HTMLElement, runtime: ShellRuntime, deps: MountDeps): () => void {
  injectThemeVariables(DEFAULT_DARK_PALETTE, root.ownerDocument.documentElement);

  root.innerHTML = `
  <style>
    ${getSharedStyles()}
    .popout { padding: 8px; min-height: 100%; height: 100%; box-sizing: border-box; overflow: hidden; }
    #popout-slot { height: 100%; min-height: 0; }
  </style>
  <main class="popout">
    <section id="popout-slot"></section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  deps.renderParts();
  deps.updateWindowReadOnlyState();
  const disposeResize = deps.setupResize();

  const onBeforeUnload = () => {
    if (!runtime.popoutTabId || !runtime.hostWindowId) {
      return;
    }
    deps.publishRestoreRequestOnUnload();
  };

  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    disposeResize();
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}
