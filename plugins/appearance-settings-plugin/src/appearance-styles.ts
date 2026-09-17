/* eslint-disable max-len */
const PANEL_STYLES = `
.appearance-panel{padding:8px;background:var(--ghost-background);color:var(--ghost-foreground)}
.appearance-panel h2{margin:0 0 12px;font-size:16px;color:var(--ghost-foreground)}
.appearance-panel h3{margin:0 0 8px;font-size:14px;color:var(--ghost-foreground)}
.appearance-section{margin-bottom:16px}
.appearance-empty{margin:0;font-size:12px;color:var(--ghost-muted-foreground)}
.appearance-theme-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:4px;border:1px solid var(--ghost-border);margin-bottom:4px;cursor:pointer;background:var(--ghost-surface)}
.appearance-theme-row:focus-visible{outline:2px solid var(--ghost-ring);outline-offset:1px}
.appearance-theme-row.is-active{border:2px solid var(--ghost-primary);background:var(--ghost-accent);color:var(--ghost-accent-foreground)}
.appearance-theme-row.is-active .appearance-theme-name{color:inherit}
.appearance-theme-row.is-active .appearance-theme-author{color:inherit;opacity:0.8}
.appearance-theme-row.is-active .appearance-mode-badge{background:color-mix(in srgb,var(--ghost-accent-foreground) 15%,transparent);color:inherit;border-color:color-mix(in srgb,var(--ghost-accent-foreground) 30%,transparent)}
.appearance-theme-name{font-size:13px;font-weight:600;color:var(--ghost-foreground)}
.appearance-theme-author{font-size:11px;color:var(--ghost-muted-foreground);margin-left:6px}
.appearance-theme-name-group{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.appearance-mode-badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;background:var(--ghost-surface-elevated);color:var(--ghost-muted-foreground);border:1px solid var(--ghost-border)}
.appearance-bg-grid{display:flex;flex-wrap:wrap;gap:6px}
.appearance-bg-thumb{width:80px;height:50px;object-fit:cover;border-radius:4px;border:1px solid var(--ghost-border);cursor:pointer}
.appearance-bg-thumb.is-active{border:2px solid var(--ghost-primary)}
.appearance-custom-row{display:flex;gap:6px;align-items:center}
.appearance-custom-label{font-size:12px;color:var(--ghost-muted-foreground);display:block;margin-bottom:4px}
.appearance-input{width:100%;box-sizing:border-box;padding:4px;background:var(--ghost-input);border:1px solid var(--ghost-border);color:var(--ghost-foreground);font-size:12px}
.appearance-select{padding:4px;background:var(--ghost-input);border:1px solid var(--ghost-border);color:var(--ghost-foreground);font-size:12px;border-radius:4px}
.appearance-btn{background:var(--ghost-surface-elevated);border:1px solid var(--ghost-border);border-radius:4px;color:var(--ghost-foreground);padding:4px 8px;cursor:pointer;font-size:11px}
.appearance-btn-primary{background:var(--ghost-primary);border:1px solid var(--ghost-border);border-radius:4px;color:var(--ghost-primary-foreground);padding:4px 8px;cursor:pointer;font-size:11px}
.appearance-custom-section{margin-top:10px}
.appearance-unavailable{padding:12px;color:var(--ghost-muted-foreground);font-size:13px}
.theme-swatch-toggle{background:none;border:none;cursor:pointer;font-size:11px;color:var(--ghost-muted-foreground);padding:2px 4px;margin-left:6px}
.theme-swatch-toggle:hover{color:var(--ghost-foreground)}
.theme-swatch-container{display:none;padding:6px 8px 2px}
.theme-swatch-container.is-open{display:block}
.theme-swatch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(28px,1fr));gap:4px}
.theme-swatch{width:24px;height:24px;border-radius:3px;border:1px solid var(--ghost-border);cursor:default}
.theme-swatch-groups{display:flex;flex-direction:column;gap:12px}
.theme-swatch-group{background:var(--ghost-surface);border:1px solid var(--ghost-border);border-radius:6px;padding:8px 10px}
.theme-swatch-group-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ghost-muted-foreground);margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid var(--ghost-border-muted)}
.appearance-bg-shimmer{width:80px;height:50px;border-radius:4px;border:1px solid var(--ghost-border);background:linear-gradient(90deg,var(--ghost-surface) 25%,var(--ghost-surface-elevated) 50%,var(--ghost-surface) 75%);background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.appearance-discovered-sections{margin-top:16px;border-top:1px solid var(--ghost-border);padding-top:12px}
.appearance-discovered-sections .appearance-section{margin-bottom:12px}
.appearance-discovered-sections .appearance-section h3{font-size:.85rem;font-weight:600;color:var(--ghost-text-secondary);margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.03em}
`;
/* eslint-enable max-len */

let styleInjected = false;

export function injectAppearanceStyles(): void {
  if (styleInjected) return;
  const s = document.createElement("style");
  s.textContent = PANEL_STYLES;
  document.head.appendChild(s);
  styleInjected = true;
}
