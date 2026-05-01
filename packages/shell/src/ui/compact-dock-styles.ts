// compact-dock-styles.ts — CSS styles for the compact dock renderer (bottom bar layout).

export const COMPACT_DOCK_STYLES = `
.ghost-compact-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ghost-compact-content {
  flex: 1;
  overflow: auto;
  position: relative;
}

.ghost-compact-content > .part-root {
  position: absolute;
  inset: 0;
}

.ghost-compact-content > .part-root[data-hidden] {
  display: none;
}

.ghost-compact-bottom-bar {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  border-top: 1px solid var(--ghost-border);
  background: var(--ghost-surface);
  flex-shrink: 0;
}

.ghost-compact-bottom-bar::-webkit-scrollbar {
  display: none;
}

.ghost-compact-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 4px 12px;
  cursor: pointer;
  color: var(--ghost-text-secondary);
  font-size: 10px;
  white-space: nowrap;
  border: none;
  background: transparent;
  transition: color 0.15s;
}

.ghost-compact-tab[data-active] {
  color: var(--ghost-text-primary);
}

.ghost-compact-tab-icon {
  font-size: 18px;
  line-height: 1;
}

.ghost-compact-tab-label {
  margin-top: 2px;
}
`;

let injected = false;

/** Inject compact dock styles into the document head (idempotent). */
export function injectCompactDockStyles(): void {
  if (injected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-ghost-compact-dock", "");
  style.textContent = COMPACT_DOCK_STYLES;
  document.head.appendChild(style);
  injected = true;
}
