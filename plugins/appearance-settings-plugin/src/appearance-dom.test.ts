// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { renderBackgroundGallery, renderThemePicker } from "./appearance-dom.js";

describe("appearance DOM", () => {
  it("preserves theme selection keyboard behavior and active state", () => {
    const onSelect = vi.fn();
    const section = renderThemePicker(
      [{ id: "theme-dark", name: "Dark", mode: "dark", author: "Ghost" }],
      "theme-dark",
      { onSelect, onGetPalette: () => null },
    );
    const row = section.querySelector<HTMLElement>(".appearance-theme-row");
    if (!row) throw new Error("Expected theme row");

    expect(row.getAttribute("role")).toBe("button");
    expect(row.getAttribute("tabindex")).toBe("0");
    expect(row.getAttribute("aria-pressed")).toBe("true");
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    row.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    row.click();
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenLastCalledWith("theme-dark");
  });

  it("preserves custom background apply and clear controls", () => {
    const onApplyCustom = vi.fn();
    const onClearCustom = vi.fn();
    const section = renderBackgroundGallery(
      [],
      { source: "custom", url: "old" },
      {
        onBackgroundSelect: vi.fn(),
        onApplyCustom,
        onClearCustom,
      },
    );
    const input = section.querySelector<HTMLInputElement>(".appearance-input");
    const select = section.querySelector<HTMLSelectElement>(".appearance-select");
    const apply = section.querySelector<HTMLButtonElement>(".appearance-btn-primary");
    const clear = section.querySelector<HTMLButtonElement>(".appearance-btn");
    if (!input || !select || !apply || !clear) throw new Error("Expected custom background controls");

    input.value = " https://example.com/background.jpg ";
    select.value = "tile";
    apply.click();
    expect(onApplyCustom).toHaveBeenCalledWith("https://example.com/background.jpg", "tile");
    expect(input.value).toBe("");
    clear.click();
    expect(onClearCustom).toHaveBeenCalledOnce();
  });
});
