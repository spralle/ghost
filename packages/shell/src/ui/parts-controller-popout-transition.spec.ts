import { describe, expect, it } from "vitest";
import { resolveClosedPopoutTransition } from "./parts-controller-popout-transition.js";

describe("parts-controller-popout-transition", () => {
  it("resolveClosedPopoutTransition separates handle cleanup from restore", () => {
    const transition = resolveClosedPopoutTransition({
      popoutHandles: new Map([
        ["tab-a", { closed: true }],
        ["tab-b", { closed: false }],
        ["tab-c", { closed: true }],
      ]),
      poppedOutTabIds: new Set(["tab-a"]),
    });

    expect(transition.closedHandleIds.join(",")).toBe("tab-a,tab-c");
    expect(transition.restoredTabIds.join(",")).toBe("tab-a");
  });
});
