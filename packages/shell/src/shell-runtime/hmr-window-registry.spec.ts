import { describe, expect, it } from "vitest";
import { getShellHmrRegistry } from "./hmr-window-registry.js";

describe("hmr-window-registry", () => {
  it("HMR registry is stable singleton and deduplicates window ids", () => {
    const first = getShellHmrRegistry();
    const second = getShellHmrRegistry();

    expect(first).toBe(second);

    const root = {} as HTMLElement;
    let disposeCalls = 0;
    first.byRoot.set(root, {
      windowId: "window-a",
      dispose() {
        disposeCalls += 1;
      },
    });

    first.windowIds.add("window-a");
    first.windowIds.add("window-a");
    expect(first.windowIds.size).toBe(1);

    const existing = first.byRoot.get(root);
    expect(existing).toBeTruthy();
    existing?.dispose();
    expect(disposeCalls).toBe(1);

    first.byRoot.delete(root);
    first.windowIds.delete("window-a");
  });
});
