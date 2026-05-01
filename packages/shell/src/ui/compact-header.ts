// compact-header.ts — Contextual header for compact dock mode with back, title, and overflow.

import { injectCompactHeaderStyles } from "./compact-header-styles.js";

export interface CompactHeaderOptions {
  readonly onBack: () => void;
  readonly onOverflow: () => void;
}

export interface CompactHeaderHandle {
  update(title: string, canGoBack: boolean): void;
  destroy(): void;
  readonly element: HTMLElement;
}

export function createCompactHeader(options: CompactHeaderOptions): CompactHeaderHandle {
  injectCompactHeaderStyles();

  const header = document.createElement("header");
  header.className = "ghost-compact-header";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "ghost-compact-header-back";
  backBtn.setAttribute("aria-label", "Go back");
  backBtn.textContent = "←";
  backBtn.dataset.hidden = "";
  backBtn.addEventListener("click", options.onBack);

  const title = document.createElement("h1");
  title.className = "ghost-compact-header-title";

  const overflowBtn = document.createElement("button");
  overflowBtn.type = "button";
  overflowBtn.className = "ghost-compact-header-overflow";
  overflowBtn.setAttribute("aria-label", "More actions");
  overflowBtn.textContent = "⋯";
  overflowBtn.addEventListener("click", options.onOverflow);

  header.append(backBtn, title, overflowBtn);

  return {
    element: header,
    update(newTitle: string, canGoBack: boolean) {
      title.textContent = newTitle;
      if (canGoBack) {
        delete backBtn.dataset.hidden;
      } else {
        backBtn.dataset.hidden = "";
      }
    },
    destroy() {
      backBtn.removeEventListener("click", options.onBack);
      overflowBtn.removeEventListener("click", options.onOverflow);
      header.remove();
    },
  };
}
