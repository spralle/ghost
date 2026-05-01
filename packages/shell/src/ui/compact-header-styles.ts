// compact-header-styles.ts — CSS styles for the compact header component.

export const COMPACT_HEADER_STYLES = `
.ghost-compact-header {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 8px;
  border-bottom: 1px solid var(--ghost-border);
  background: var(--ghost-surface);
  flex-shrink: 0;
}

.ghost-compact-header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ghost-text-primary);
  font-size: 18px;
  border-radius: 50%;
}

.ghost-compact-header-back:hover {
  background: var(--ghost-hover);
}

.ghost-compact-header-back[data-hidden] {
  visibility: hidden;
}

.ghost-compact-header-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--ghost-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  padding: 0 8px;
}

.ghost-compact-header-overflow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ghost-text-secondary);
  font-size: 18px;
  border-radius: 50%;
}

.ghost-compact-header-overflow:hover {
  background: var(--ghost-hover);
}
`;

let injected = false;

/** Inject compact header styles into the document head (idempotent). */
export function injectCompactHeaderStyles(): void {
  if (injected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-ghost-compact-header", "");
  style.textContent = COMPACT_HEADER_STYLES;
  document.head.appendChild(style);
  injected = true;
}
