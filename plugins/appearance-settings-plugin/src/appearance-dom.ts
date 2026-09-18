// appearance-dom.ts — Vanilla DOM rendering helpers for the appearance settings UI.
import type { ThemeBackgroundEntry } from "@ghost-shell/contracts/plugin";
import type { ActivityStatusService, BackgroundInfo } from "@ghost-shell/contracts/services";

export { injectAppearanceStyles } from "./appearance-styles.js";
export { renderThemePicker, type ThemePickerCallbacks } from "./appearance-theme-picker.js";

const blobUrlCache = new Map<string, string>();
let galleryObserver: IntersectionObserver | null = null;
let galleryActivityToken: { dispose(): void } | null = null;

function createSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return {
    acquire(): Promise<void> {
      if (active < max) {
        active++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) =>
        queue.push(() => {
          active++;
          resolve();
        }),
      );
    },
    release(): void {
      active--;
      const next = queue.shift();
      if (next) next();
    },
  };
}

async function resolveThumbnailUrl(url: string): Promise<string> {
  const memo = blobUrlCache.get(url);
  if (memo) return memo;
  if (typeof window === "undefined" || typeof caches === "undefined") return url;
  try {
    const cache = await caches.open("ghost-theme-backgrounds-v1");
    const hit = await cache.match(url);
    if (hit) {
      const b = URL.createObjectURL(await hit.blob());
      blobUrlCache.set(url, b);
      return b;
    }
    const r = await fetch(url, { mode: "cors" });
    await cache.put(url, r.clone());
    const b = URL.createObjectURL(await r.blob());
    blobUrlCache.set(url, b);
    return b;
  } catch {
    return url;
  }
}

export function revokeGalleryBlobUrls(): void {
  if (galleryObserver) {
    galleryObserver.disconnect();
    galleryObserver = null;
  }
  if (galleryActivityToken) {
    galleryActivityToken.dispose();
    galleryActivityToken = null;
  }
  for (const u of blobUrlCache.values()) URL.revokeObjectURL(u);
  blobUrlCache.clear();
}

export interface BackgroundGalleryCallbacks {
  onBackgroundSelect: (index: number) => void;
  onApplyCustom: (url: string, mode: "cover" | "contain" | "tile") => void;
  onClearCustom: () => void;
  activityService?: ActivityStatusService;
}

function beginGalleryActivity(count: number, callbacks: BackgroundGalleryCallbacks): () => void {
  if (galleryActivityToken) {
    galleryActivityToken.dispose();
    galleryActivityToken = null;
  }
  let pendingCount = count;
  if (callbacks.activityService && pendingCount > 0) {
    galleryActivityToken = callbacks.activityService.startActivity("Loading backgrounds");
  }
  return () => {
    pendingCount--;
    if (pendingCount <= 0 && galleryActivityToken) {
      galleryActivityToken.dispose();
      galleryActivityToken = null;
    }
  };
}

async function loadBackgroundThumbnail(
  placeholder: HTMLElement,
  backgroundIndex: number,
  backgroundUrl: string,
  isActive: boolean,
  callbacks: BackgroundGalleryCallbacks,
  semaphore: ReturnType<typeof createSemaphore>,
  onSettled: () => void,
): Promise<void> {
  try {
    await semaphore.acquire();
    const resolved = await resolveThumbnailUrl(backgroundUrl);
    const image = document.createElement("img");
    image.className = isActive ? "appearance-bg-thumb is-active" : "appearance-bg-thumb";
    image.src = resolved;
    image.alt = `Background ${backgroundIndex + 1}`;
    image.addEventListener("click", () => callbacks.onBackgroundSelect(backgroundIndex));
    placeholder.replaceWith(image);
  } catch {
    const fallback = document.createElement("div");
    fallback.className = "appearance-bg-thumb";
    fallback.style.background = "var(--ghost-surface-elevated)";
    fallback.addEventListener("click", () => callbacks.onBackgroundSelect(backgroundIndex));
    placeholder.replaceWith(fallback);
  } finally {
    semaphore.release();
    onSettled();
  }
}

function createGalleryObserver(
  activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
  semaphore: ReturnType<typeof createSemaphore>,
  onSettled: () => void,
): IntersectionObserver {
  return new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
        const placeholder = entry.target;
        observer.unobserve(placeholder);
        const backgroundIndex = Number(placeholder.dataset.bgIndex);
        const backgroundUrl = placeholder.dataset.bgUrl ?? "";
        const isActive = activeBackground?.source === "theme" && activeBackground.index === backgroundIndex;
        void loadBackgroundThumbnail(
          placeholder,
          backgroundIndex,
          backgroundUrl,
          isActive,
          callbacks,
          semaphore,
          onSettled,
        );
      }
    },
    { rootMargin: "100px" },
  );
}

function createBackgroundGrid(
  backgrounds: ThemeBackgroundEntry[],
  activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "appearance-bg-grid";
  const semaphore = createSemaphore(3);
  const onSettled = beginGalleryActivity(backgrounds.length, callbacks);
  galleryObserver?.disconnect();
  galleryObserver = createGalleryObserver(activeBackground, callbacks, semaphore, onSettled);
  backgrounds.forEach((background, index) => {
    const placeholder = document.createElement("div");
    placeholder.className = "appearance-bg-shimmer";
    placeholder.dataset.bgIndex = String(index);
    placeholder.dataset.bgUrl = background.url;
    placeholder.addEventListener("click", () => callbacks.onBackgroundSelect(index));
    grid.appendChild(placeholder);
    galleryObserver?.observe(placeholder);
  });
  return grid;
}

export function renderBackgroundGallery(
  backgrounds: ThemeBackgroundEntry[],
  activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "appearance-section";
  const heading = document.createElement("h3");
  heading.textContent = "Background";
  section.appendChild(heading);
  if (backgrounds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "appearance-empty";
    empty.textContent = "No backgrounds available for this theme.";
    section.appendChild(empty);
  } else {
    section.appendChild(createBackgroundGrid(backgrounds, activeBackground, callbacks));
  }
  section.appendChild(renderCustomBackgroundInput(activeBackground, callbacks));
  return section;
}

type BackgroundMode = "cover" | "contain" | "tile";

function createBackgroundModeSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "appearance-select";
  for (const mode of ["cover", "contain", "tile"] as const) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    select.appendChild(option);
  }
  return select;
}

function readBackgroundMode(select: HTMLSelectElement): BackgroundMode {
  if (select.value === "contain" || select.value === "tile") return select.value;
  return "cover";
}

function bindCustomBackgroundApplication(
  input: HTMLInputElement,
  select: HTMLSelectElement,
  button: HTMLButtonElement,
  callbacks: BackgroundGalleryCallbacks,
): void {
  const applyCustom = () => {
    const trimmed = input.value.trim();
    if (!trimmed) return;
    callbacks.onApplyCustom(trimmed, readBackgroundMode(select));
    input.value = "";
  };
  button.addEventListener("click", applyCustom);
  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCustom();
    }
  });
}

function createClearBackgroundButton(onClear: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "appearance-btn";
  button.type = "button";
  button.textContent = "Clear custom background";
  button.style.marginTop = "6px";
  button.addEventListener("click", onClear);
  return button;
}

function renderCustomBackgroundInput(
  activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "appearance-custom-section";
  const label = document.createElement("label");
  label.className = "appearance-custom-label";
  label.textContent = "Custom background URL";
  wrapper.appendChild(label);
  const row = document.createElement("div");
  row.className = "appearance-custom-row";
  const input = document.createElement("input");
  input.className = "appearance-input";
  input.placeholder = "https://example.com/image.jpg";
  const select = createBackgroundModeSelect();
  const applyBtn = document.createElement("button");
  applyBtn.className = "appearance-btn-primary";
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  bindCustomBackgroundApplication(input, select, applyBtn, callbacks);
  row.appendChild(input);
  row.appendChild(select);
  row.appendChild(applyBtn);
  wrapper.appendChild(row);
  if (activeBackground?.source === "custom") {
    wrapper.appendChild(createClearBackgroundButton(callbacks.onClearCustom));
  }
  return wrapper;
}

export function renderSectionContainer(): HTMLElement {
  const container = document.createElement("div");
  container.className = "appearance-discovered-sections";
  return container;
}

export function updateBackgroundSelection(container: HTMLElement, activeBackground: BackgroundInfo | null): void {
  container.querySelectorAll<HTMLElement>(".appearance-bg-thumb").forEach((thumb, index) => {
    thumb.classList.toggle("is-active", activeBackground?.source === "theme" && activeBackground.index === index);
  });
}
