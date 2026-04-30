// theme-background-layer.ts — Manages background rendering via the layer system.

import type { ThemeBackgroundEntry } from "@ghost-shell/contracts";
import type { LayerRegistry } from "@ghost-shell/layer";
import { manageBackgroundImage, resolveBackgroundUrl } from "@ghost-shell/theme";

export interface BackgroundLayerController {
  apply(entry: ThemeBackgroundEntry | undefined): void;
}

/**
 * Creates a controller that renders the theme background through the layer
 * system when a LayerRegistry is provided, falling back to the legacy
 * body-level div when it is not.
 */
export function createBackgroundLayerController(
  layerRegistry: LayerRegistry | undefined,
): BackgroundLayerController {
  let registered = false;
  let currentEntry: ThemeBackgroundEntry | undefined;

  function apply(entry: ThemeBackgroundEntry | undefined): void {
    currentEntry = entry;

    if (!layerRegistry) {
      manageBackgroundImage(entry ? [entry] : undefined);
      return;
    }

    if (!entry) {
      layerRegistry.unregisterShellSurface("shell-background");
      registered = false;
      return;
    }

    if (!registered) {
      layerRegistry.registerShellSurface({
        id: "shell-background",
        layer: "background",
        order: 0,
        mount: (container) => {
          applyStyles(container);
          return () => {
            container.style.backgroundImage = "";
          };
        },
      });
      registered = true;
    } else {
      updateMountedElement();
    }
  }

  function applyStyles(el: HTMLElement): void {
    const entry = currentEntry;
    if (!entry) return;

    el.style.backgroundImage = `url(${entry.url})`;
    const mode = entry.mode ?? "cover";
    if (mode === "tile") {
      el.style.backgroundSize = "auto";
      el.style.backgroundRepeat = "repeat";
    } else {
      el.style.backgroundSize = mode;
      el.style.backgroundRepeat = "no-repeat";
    }
    el.style.backgroundPosition = "center";

    void resolveBackgroundUrl(entry.url).then((resolved) => {
      if (resolved !== entry.url) {
        el.style.backgroundImage = `url(${resolved})`;
      }
    });
  }

  function updateMountedElement(): void {
    if (typeof document === "undefined") return;
    const el = document.querySelector<HTMLElement>('[data-shell-surface="shell-background"]');
    if (el) {
      applyStyles(el);
    }
  }

  return { apply };
}
