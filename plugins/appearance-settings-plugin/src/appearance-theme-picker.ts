import type { ThemeInfo } from "@ghost-shell/contracts/services";
import { GHOST_THEME_CSS_VARS, THEME_TOKEN_GROUPS } from "@ghost-shell/theme";

const ANSI_NAMES: Record<string, string> = {
  color0: "Black",
  color1: "Red",
  color2: "Green",
  color3: "Yellow",
  color4: "Blue",
  color5: "Magenta",
  color6: "Cyan",
  color7: "White",
  color8: "Bright Black",
  color9: "Bright Red",
  color10: "Bright Green",
  color11: "Bright Yellow",
  color12: "Bright Blue",
  color13: "Bright Magenta",
  color14: "Bright Cyan",
  color15: "Bright White",
};

const isColor = (value: string) => /^#|^rgb|^hsl|^color-mix/.test(value);

function cssVarToLabel(cssVar: string): string {
  return cssVar
    .replace(/^--ghost-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function makeSwatch(color: string, label: string, cssVar?: string): HTMLElement {
  const swatch = document.createElement("div");
  swatch.className = "theme-swatch";
  swatch.style.backgroundColor = color;
  swatch.title = cssVar ? `${label}\n${cssVar}` : label;
  return swatch;
}

function makeGroup(label: string, swatches: HTMLElement[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "theme-swatch-group";
  const heading = document.createElement("p");
  heading.className = "theme-swatch-group-label";
  heading.textContent = label;
  group.appendChild(heading);
  const grid = document.createElement("div");
  grid.className = "theme-swatch-grid";
  for (const swatch of swatches) grid.appendChild(swatch);
  group.appendChild(grid);
  return group;
}

function appendThemeTokenGroups(container: HTMLElement, palette: Record<string, string>, used: Set<string>): void {
  for (const group of THEME_TOKEN_GROUPS) {
    const swatches: HTMLElement[] = [];
    for (const token of group.tokens) {
      const cssVar = Reflect.get(GHOST_THEME_CSS_VARS, token);
      if (typeof cssVar !== "string") continue;
      const color = palette[cssVar];
      if (color && isColor(color)) {
        swatches.push(makeSwatch(color, cssVarToLabel(cssVar), cssVar));
        used.add(cssVar);
      }
    }
    if (swatches.length > 0) container.appendChild(makeGroup(group.label, swatches));
  }
}

function appendTerminalColors(container: HTMLElement, palette: Record<string, string>, used: Set<string>): void {
  const swatches: HTMLElement[] = [];
  for (const [key, color] of Object.entries(palette)) {
    if (!key.startsWith("--ghost-terminal-")) continue;
    used.add(key);
    if (!isColor(color)) continue;
    const token = key.replace("--ghost-terminal-", "");
    const name = ANSI_NAMES[token];
    swatches.push(makeSwatch(color, name ? `${name} (${token})` : key));
  }
  if (swatches.length > 0) container.appendChild(makeGroup("Terminal", swatches));
}

function createSwatchGrid(palette: Record<string, string>): HTMLElement {
  const container = document.createElement("div");
  container.className = "theme-swatch-groups";
  const used = new Set<string>();
  appendThemeTokenGroups(container, palette, used);
  appendTerminalColors(container, palette, used);
  const other = Object.entries(palette)
    .filter(([key, color]) => !used.has(key) && isColor(color))
    .map(([key, color]) => makeSwatch(color, cssVarToLabel(key), key));
  if (other.length > 0) container.appendChild(makeGroup("Other", other));
  return container;
}

export interface ThemePickerCallbacks {
  onSelect: (themeId: string) => void;
  onGetPalette: (themeId: string) => Record<string, string> | null;
}

function createThemeNameGroup(theme: ThemeInfo): HTMLElement {
  const nameGroup = document.createElement("span");
  nameGroup.className = "appearance-theme-name-group";
  const nameText = document.createElement("span");
  nameText.className = "appearance-theme-name";
  nameText.textContent = theme.name;
  nameGroup.appendChild(nameText);
  if (theme.author) {
    const author = document.createElement("span");
    author.className = "appearance-theme-author";
    author.textContent = `by ${theme.author}`;
    nameGroup.appendChild(author);
  }
  return nameGroup;
}

function bindThemeSelection(row: HTMLElement, themeId: string, onSelect: (themeId: string) => void): void {
  row.addEventListener("click", () => onSelect(themeId));
  row.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(themeId);
    }
  });
}

function createThemeSwatchPreview(
  themeId: string,
  callbacks: ThemePickerCallbacks,
): { toggle: HTMLButtonElement; container: HTMLElement } {
  const container = document.createElement("div");
  container.className = "theme-swatch-container";
  const toggle = document.createElement("button");
  toggle.className = "theme-swatch-toggle";
  toggle.type = "button";
  toggle.textContent = "▶";
  toggle.title = "Preview theme tokens";
  toggle.addEventListener("click", (event: MouseEvent) => {
    event.stopPropagation();
    const isOpen = container.classList.toggle("is-open");
    toggle.textContent = isOpen ? "▼" : "▶";
    if (isOpen && container.children.length === 0) {
      const palette = callbacks.onGetPalette(themeId);
      if (palette) container.appendChild(createSwatchGrid(palette));
    }
  });
  return { toggle, container };
}

function createThemePickerRow(
  theme: ThemeInfo,
  isActive: boolean,
  callbacks: ThemePickerCallbacks,
): { row: HTMLElement; swatches: HTMLElement } {
  const row = document.createElement("div");
  row.className = isActive ? "appearance-theme-row is-active" : "appearance-theme-row";
  row.setAttribute("role", "button");
  row.setAttribute("tabindex", "0");
  row.setAttribute("aria-pressed", isActive ? "true" : "false");
  row.appendChild(createThemeNameGroup(theme));
  const badge = document.createElement("span");
  badge.className = "appearance-mode-badge";
  badge.textContent = theme.mode;
  row.appendChild(badge);
  const preview = createThemeSwatchPreview(theme.id, callbacks);
  row.appendChild(preview.toggle);
  bindThemeSelection(row, theme.id, callbacks.onSelect);
  return { row, swatches: preview.container };
}

export function renderThemePicker(
  themes: ThemeInfo[],
  activeThemeId: string | null,
  callbacks: ThemePickerCallbacks,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "appearance-section";
  const heading = document.createElement("h3");
  heading.textContent = "Theme";
  section.appendChild(heading);
  if (themes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "appearance-empty";
    empty.textContent = "No themes available.";
    section.appendChild(empty);
    return section;
  }
  for (const theme of themes) {
    const pickerRow = createThemePickerRow(theme, theme.id === activeThemeId, callbacks);
    section.appendChild(pickerRow.row);
    section.appendChild(pickerRow.swatches);
  }
  return section;
}
