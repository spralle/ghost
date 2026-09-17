import { DRAG_INLINE_PREFIX, TAB_DOCK_DRAG_MIME } from "./app/constants.js";
import type { ShellRuntime } from "./app/types.js";
import {
  createIncomingTransferJournal,
  createInitialShellContextState,
  registerTab,
  type ShellContextState,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { createWorkspacePersistenceFixture } from "./test-fixtures/workspace-persistence-fixture.js";
import { wireTabStripDragDrop } from "./ui/tab-drag-drop.js";

interface DragDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (format: string, value: string) => void;
  getData: (format: string) => string;
  setDragImage: (image: Element, x: number, y: number) => void;
}

type DragListener = (event: DragEvent) => void;

class FakeTabButton {
  readonly dataset: DOMStringMap;
  draggable = false;
  private readonly listeners = new Map<string, DragListener[]>();

  constructor(tabId: string) {
    this.dataset = { partId: tabId };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized =
      typeof listener === "function"
        ? (listener as DragListener)
        : (event: DragEvent) => listener.handleEvent(event as unknown as Event);
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  dispatch(type: "dragstart" | "drag" | "dragend", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeTabItem {
  readonly dataset: DOMStringMap;
  draggable = false;
  private readonly listeners = new Map<string, DragListener[]>();

  constructor(
    tabId: string,
    private readonly tabButton: FakeTabButton,
  ) {
    this.dataset = { tabItem: tabId };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized =
      typeof listener === "function"
        ? (listener as DragListener)
        : (event: DragEvent) => listener.handleEvent(event as unknown as Event);
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  querySelector<T>(selector: string): T | null {
    if (selector === "button[data-action='activate-tab']") {
      return this.tabButton as unknown as T;
    }
    return null;
  }

  dispatch(type: "dragstart" | "dragend" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeButtonNode {
  constructor(private readonly owner: FakeTabButton) {}

  closest(selector: string): FakeTabButton | null {
    if (selector === "button[data-action='activate-tab'][data-part-id]") {
      return this.owner;
    }
    return null;
  }
}

class FakeRoot {
  private readonly classes = new Set<string>();
  private readonly listeners = new Map<string, DragListener[]>();

  readonly classList = {
    add: (className: string) => {
      this.classes.add(className);
    },
    remove: (className: string) => {
      this.classes.delete(className);
    },
    contains: (className: string) => this.classes.has(className),
  };

  constructor(private readonly tabItems: FakeTabItem[]) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized =
      typeof listener === "function"
        ? (listener as DragListener)
        : (event: DragEvent) => listener.handleEvent(event as unknown as Event);
    const existing = this.listeners.get(type) ?? [];
    existing.push(normalized);
    this.listeners.set(type, existing);
  }

  querySelectorAll<T>(selector: string): T[] {
    if (selector === "[data-tab-item]") {
      return this.tabItems as unknown as T[];
    }
    return [];
  }
}

class MemoryDataTransfer implements DragDataTransfer {
  effectAllowed = "none";
  dropEffect = "none";
  private readonly data = new Map<string, string>();

  setData(format: string, value: string): void {
    this.data.set(format, value);
  }

  getData(format: string): string {
    return this.data.get(format) ?? "";
  }

  setDragImage(_image: Element, _x: number, _y: number): void {}
}

class EmptyReadDataTransfer extends MemoryDataTransfer {
  override getData(_format: string): string {
    return "";
  }
}

function createDragEvent(dataTransfer: DragDataTransfer, target?: EventTarget): DragEvent {
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
    target: target ?? null,
    preventDefault() {},
    stopPropagation() {},
  } as DragEvent;
}

async function flushTimers(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createButtonTarget(button: FakeTabButton): EventTarget {
  return new FakeButtonNode(button) as unknown as EventTarget;
}

function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, { tabId: "tab-b", groupId: "group-main" });
  state = registerTab(state, { tabId: "tab-c", groupId: "group-main" });

  const runtime = {
    windowId: "window-a",
    syncDegraded: false,
    contextState: state,
    ...createWorkspacePersistenceFixture(state),
    notice: "",
    dragSessionBroker: {
      available: false,
      create: () => ({ id: "unused" }),
      consume: () => null,
      commit: () => false,
      abort: () => false,
      pruneExpired: () => 0,
      dispose: () => {},
    },
    incomingTransferJournal: createIncomingTransferJournal(),
    crossWindowDndEnabled: true,
    crossWindowDndKillSwitchActive: false,
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;

  return runtime;
}

function createTabHarness(tabIds: string[]): {
  root: FakeRoot;
  tabButtons: Map<string, FakeTabButton>;
  tabItems: Map<string, FakeTabItem>;
} {
  const tabButtons = new Map<string, FakeTabButton>();
  const tabItems = new Map<string, FakeTabItem>();
  const items: FakeTabItem[] = [];

  for (const tabId of tabIds) {
    const button = new FakeTabButton(tabId);
    const item = new FakeTabItem(tabId, button);
    tabButtons.set(tabId, button);
    tabItems.set(tabId, item);
    items.push(item);
  }

  return {
    root: new FakeRoot(items),
    tabButtons,
    tabItems,
  };
}

function wireWithMoved(runtime: ShellRuntime, tabHarness: ReturnType<typeof createTabHarness>, moved: string[]): void {
  wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, {
    onTabMoved(tabId) {
      moved.push(tabId);
    },
    onStateChange() {},
  });
}

function wireNoop(runtime: ShellRuntime, tabHarness: ReturnType<typeof createTabHarness>): void {
  wireTabStripDragDrop(tabHarness.root as unknown as HTMLElement, runtime, { onTabMoved() {}, onStateChange() {} });
}

export function registerTabDragDropSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("same-window tab drop reorders and activates dragged tab", async () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const dragTransfer = new MemoryDataTransfer();
    tabHarness.tabButtons
      .get("tab-c")
      ?.dispatch("dragstart", createDragEvent(dragTransfer, createButtonTarget(tabHarness.tabButtons.get("tab-c")!)));
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(dragTransfer));

    assertEqual(
      runtime.contextState.tabOrder.join(","),
      "tab-a,tab-c,tab-b",
      "drop should deterministically reorder tab order",
    );
    assertEqual(runtime.contextState.activeTabId, "tab-c", "drop should activate moved tab");
    assertEqual(moved.join(","), "tab-c", "drop callback should run for moved tab");
  });

  test("malformed drag payload is ignored as safe no-op", async () => {
    const runtime = createRuntime();
    const before = runtime.contextState;
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", `${DRAG_INLINE_PREFIX}{"kind":"invalid"}`);
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState, before, "invalid payload should not mutate context state");
    assertEqual(moved.length, 0, "invalid payload should not trigger move callback");
  });

  test("cross-window payload without transfer session is rejected as invalid payload", async () => {
    const runtime = createRuntime();
    const before = runtime.contextState;
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const transfer = new MemoryDataTransfer();
    transfer.setData(
      "text/plain",
      `${DRAG_INLINE_PREFIX}{"kind":"shell-tab-dnd","tabId":"tab-c","sourceWindowId":"window-b"}`,
    );
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(transfer));

    assertEqual(
      runtime.contextState,
      before,
      "cross-window payload without transfer session should not mutate context state",
    );
    assertEqual(moved.length, 0, "cross-window payload should not trigger move callback");
    assertEqual(
      runtime.notice,
      "Cross-window tab drag payload is invalid.",
      "cross-window inline payload without transfer session should surface invalid payload notice",
    );
  });

  test("cross-window tab drop applies through transfer transaction when enabled", async () => {
    const runtime = createRuntime();
    runtime.crossWindowDndEnabled = true;
    const commits: string[] = [];
    runtime.dragSessionBroker = {
      ...runtime.dragSessionBroker,
      consume: () => ({ kind: "shell-tab-dnd", tabId: "tab-c", sourceWindowId: "window-b" }),
      commit(ref) {
        commits.push(ref.id);
        return true;
      },
      abort: () => false,
    };

    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", "ghost-dnd-ref:session-cross-tab");
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(transfer));

    assertEqual(
      runtime.contextState.tabOrder.join(","),
      "tab-a,tab-c,tab-b",
      "enabled cross-window tab drop should insert via incoming transaction",
    );
    assertEqual(
      runtime.contextState.activeTabId,
      "tab-c",
      "enabled cross-window tab drop should activate incoming tab",
    );
    assertEqual(moved.join(","), "tab-c", "enabled cross-window tab drop should run move callback");
    assertEqual(commits.join(","), "session-cross-tab", "enabled cross-window tab drop should commit transfer session");
    assertEqual(runtime.notice, "", "enabled cross-window tab drop should clear rejection notice");
  });

  test("cross-window tab drop shows notice and aborts when disabled", async () => {
    const runtime = createRuntime();
    runtime.crossWindowDndEnabled = false;
    const aborts: string[] = [];
    runtime.dragSessionBroker = {
      ...runtime.dragSessionBroker,
      consume: () => ({ kind: "shell-tab-dnd", tabId: "tab-c", sourceWindowId: "window-b" }),
      commit: () => false,
      abort(ref) {
        aborts.push(ref.id);
        return true;
      },
    };

    const before = runtime.contextState;
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    wireNoop(runtime, tabHarness);

    const transfer = new MemoryDataTransfer();
    transfer.setData("text/plain", "ghost-dnd-ref:session-cross-disabled");
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState, before, "disabled cross-window tab drop should preserve same-window-only state");
    assertEqual(
      runtime.notice,
      "Cross-window tab drag is disabled by current settings.",
      "disabled cross-window tab drop should show clear rejection notice",
    );
    assertEqual(
      aborts.join(","),
      "session-cross-disabled",
      "disabled cross-window tab drop should abort transfer session",
    );
  });

  test("tab drop reorders using dock MIME payload fallback", async () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const transfer = new MemoryDataTransfer();
    transfer.setData(TAB_DOCK_DRAG_MIME, JSON.stringify({ tabId: "tab-c", sourceWindowId: "window-a" }));
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(transfer));

    assertEqual(runtime.contextState.tabOrder.join(","), "tab-a,tab-c,tab-b", "dock MIME fallback should reorder tabs");
    assertEqual(runtime.contextState.activeTabId, "tab-c", "dock MIME fallback should activate dragged tab");
    assertEqual(moved.join(","), "tab-c", "dock MIME fallback should trigger move callback");
  });

  test("tab drop reorders using active drag payload fallback when reads are empty", async () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const dragStartTransfer = new MemoryDataTransfer();
    tabHarness.tabButtons
      .get("tab-c")
      ?.dispatch(
        "dragstart",
        createDragEvent(dragStartTransfer, createButtonTarget(tabHarness.tabButtons.get("tab-c")!)),
      );

    const emptyReadTransfer = new EmptyReadDataTransfer();
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(emptyReadTransfer));

    assertEqual(
      runtime.contextState.tabOrder.join(","),
      "tab-a,tab-c,tab-b",
      "active payload fallback should reorder tabs",
    );
    assertEqual(runtime.contextState.activeTabId, "tab-c", "active payload fallback should activate dragged tab");
    assertEqual(moved.join(","), "tab-c", "active payload fallback should trigger move callback");
  });

  test("drop applies when browser emits dragend before drop", async () => {
    const runtime = createRuntime();
    const tabHarness = createTabHarness(["tab-a", "tab-b", "tab-c"]);
    const moved: string[] = [];
    wireWithMoved(runtime, tabHarness, moved);

    const transfer = new MemoryDataTransfer();
    tabHarness.tabButtons
      .get("tab-c")
      ?.dispatch("dragstart", createDragEvent(transfer, createButtonTarget(tabHarness.tabButtons.get("tab-c")!)));
    tabHarness.tabButtons.get("tab-c")?.dispatch("dragend", createDragEvent(transfer));
    tabHarness.tabItems.get("tab-b")?.dispatch("drop", createDragEvent(transfer));
    await flushTimers();

    assertEqual(
      runtime.contextState.tabOrder.join(","),
      "tab-a,tab-c,tab-b",
      "drop after premature dragend should reorder tabs",
    );
    assertEqual(runtime.contextState.activeTabId, "tab-c", "drop after premature dragend should activate dragged tab");
    assertEqual(moved.join(","), "tab-c", "drop after premature dragend should trigger move callback");
  });
}
