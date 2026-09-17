import type { ComposedShellPart } from "./parts-rendering.js";
import { renderPartBody } from "./parts-rendering-body.js";
import { renderPartPopoutButton } from "./parts-rendering-popout-button.js";

export function renderDockDropOverlay(targetTabId: string): string {
  return `<div class="dock-drop-overlay" data-dock-drop-overlay-for="${targetTabId}" aria-hidden="true">
      <div class="dock-drop-preview"></div>
      <div class="dock-drop-zone dock-drop-zone-left" data-dock-drop-zone="left" data-target-tab-id="${targetTabId}" title="Drop to split left of this panel"></div>
      <div class="dock-drop-zone dock-drop-zone-right" data-dock-drop-zone="right" data-target-tab-id="${targetTabId}" title="Drop to split right of this panel"></div>
      <div class="dock-drop-zone dock-drop-zone-top" data-dock-drop-zone="top" data-target-tab-id="${targetTabId}" title="Drop to split above this panel"></div>
      <div class="dock-drop-zone dock-drop-zone-bottom" data-dock-drop-zone="bottom" data-target-tab-id="${targetTabId}" title="Drop to split below this panel"></div>
      <div class="dock-drop-zone dock-drop-zone-center" data-dock-drop-zone="center" data-target-tab-id="${targetTabId}" title="Drop to merge into this tab stack"></div>
    </div>`;
}

export function renderDockPartPanel(part: ComposedShellPart, isActive: boolean): string {
  return `<section
      class="dock-tabpanel"
      id="panel-${part.id}"
      role="tabpanel"
      aria-labelledby="tab-${part.id}"
      ${isActive ? "" : "hidden"}
    >
      <section class="dock-tabpanel-content" data-tab-id="${part.id}" data-part-id="${part.id}">
        <div class="part-actions">
          ${renderPartPopoutButton(part)}
        </div>
        ${renderPartBody(part)}
      </section>
    </section>`;
}
