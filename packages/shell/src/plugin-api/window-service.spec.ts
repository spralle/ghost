import { describe, expect, it } from "vitest";
import type { QuickPickItem } from "@ghost-shell/contracts";
import { createWindowService, type WindowServiceDependencies } from "./window-service.js";

function createTestDeps(overrides: Partial<WindowServiceDependencies> = {}): WindowServiceDependencies {
  return {
    getWindowId: () => "win-main",
    getIsPopout: () => false,
    getHostWindowId: () => null,
    getPopoutHandles: () => new Map(),
    getSelectedPartId: () => "part-1",
    renderQuickPick: () => {},
    dismissQuickPick: () => {},
    ...overrides,
  };
}

describe("window service", () => {
  // ─── windowId / isPopout ───

  it("window-service: windowId returns correct value", () => {
    const { service } = createWindowService(createTestDeps({ getWindowId: () => "win-42" }));
    expect(service.windowId).toBe("win-42");
  });

  it("window-service: isPopout returns false for host window", () => {
    const { service } = createWindowService(createTestDeps());
    expect(service.isPopout).toBe(false);
  });

  it("window-service: isPopout returns true for popout window", () => {
    const { service } = createWindowService(createTestDeps({ getIsPopout: () => true }));
    expect(service.isPopout).toBe(true);
  });

  // ─── getWindows() ───

  it("window-service: getWindows returns current window when no popouts", () => {
    const { service } = createWindowService(createTestDeps());

    const windows = service.getWindows();
    expect(windows.length).toBe(1);
    expect(windows[0].windowId).toBe("win-main");
    expect(windows[0].isPopout).toBe(false);
    expect(windows[0].hostWindowId).toBe(null);
    expect(windows[0].activePartId).toBe("part-1");
  });

  it("window-service: getWindows returns current window plus popouts", () => {
    const popouts = new Map<string, Window>();
    // Use minimal Window-like objects for test purposes
    popouts.set("win-pop-1", {} as Window);
    popouts.set("win-pop-2", {} as Window);

    const { service } = createWindowService(createTestDeps({ getPopoutHandles: () => popouts }));

    const windows = service.getWindows();
    expect(windows.length).toBe(3);

    const host = windows.find((w) => w.windowId === "win-main");
    expect(host).toBeTruthy();
    expect(host?.isPopout).toBe(false);

    const pop1 = windows.find((w) => w.windowId === "win-pop-1");
    expect(pop1).toBeTruthy();
    expect(pop1?.isPopout).toBe(true);
    expect(pop1?.hostWindowId).toBe("win-main");

    const pop2 = windows.find((w) => w.windowId === "win-pop-2");
    expect(pop2).toBeTruthy();
    expect(pop2?.isPopout).toBe(true);
  });

  // ─── showQuickPick() ───

  it("window-service: showQuickPick resolves with selected item on accept", async () => {
    const items: QuickPickItem[] = [{ label: "Alpha" }, { label: "Beta" }];

    const { service } = createWindowService(
      createTestDeps({
        renderQuickPick: (controller) => {
          // Simulate user accepting immediately after show
          setTimeout(() => {
            const ctrl = controller as unknown as { fireAccept(): void };
            ctrl.fireAccept();
          }, 0);
        },
      }),
    );

    const result = await service.showQuickPick(items, {
      placeholder: "Pick one",
    });

    // The first item is active by default after show()
    expect(result !== undefined).toBeTruthy();
    expect(result?.label).toBe("Alpha");
  });

  it("window-service: showQuickPick resolves with undefined on hide", async () => {
    const items: QuickPickItem[] = [{ label: "Alpha" }, { label: "Beta" }];

    const { service } = createWindowService(
      createTestDeps({
        renderQuickPick: (controller) => {
          // Simulate user pressing Escape
          setTimeout(() => {
            (controller as { hide(): void }).hide();
          }, 0);
        },
      }),
    );

    const result = await service.showQuickPick(items);
    expect(result).toBe(undefined);
  });

  // ─── createQuickPick() ───

  it("window-service: createQuickPick returns a controllable QuickPick", () => {
    const { service } = createWindowService(createTestDeps());

    const qp = service.createQuickPick<QuickPickItem>();
    expect(qp).toBeTruthy();

    qp.items = [{ label: "Test" }];
    expect(qp.items.length).toBe(1);
    expect(qp.items[0].label).toBe("Test");

    qp.placeholder = "Type here";
    expect(qp.placeholder).toBe("Type here");

    qp.show();
    expect(qp.activeItems.length).toBe(1);

    let acceptFired = false;
    qp.onDidAccept(() => {
      acceptFired = true;
    });

    // fireAccept is on QuickPickController but the QuickPick<T> interface
    // doesn't expose it — we access it via the full controller type
    (qp as unknown as { fireAccept(): void }).fireAccept();
    expect(acceptFired).toBe(true);

    qp.dispose();
  });

  // ─── onDidChangeWindows ───

  it("window-service: onDidChangeWindows fires when triggered", () => {
    const result = createWindowService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeWindows(() => {
      fired += 1;
    });

    result.fireWindowsChanged();
    expect(fired).toBe(1);

    result.fireWindowsChanged();
    expect(fired).toBe(2);
  });

  it("window-service: dispose clears all listeners", () => {
    const result = createWindowService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeWindows(() => {
      fired += 1;
    });

    result.fireWindowsChanged();
    expect(fired).toBe(1);

    result.dispose();
    result.fireWindowsChanged();
    expect(fired).toBe(1);
  });
});
