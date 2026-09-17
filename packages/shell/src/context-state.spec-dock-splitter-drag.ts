import type { ShellRuntime } from "./app/types.js";
import {
  createInitialShellContextState,
  type DockOrientation,
  moveTabInDockTree,
  readDockSplitRatio,
  registerTab,
  type ShellContextState,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { createWorkspacePersistenceFixture } from "./test-fixtures/workspace-persistence-fixture.js";
import { wireDockSplitterDrag } from "./ui/dock-splitter-dnd.js";

type PointerListener = (event: PointerEvent) => void;
type GenericListener = (event: Event) => void;

class FakeWindow {
  private readonly listeners = new Map<string, GenericListener[]>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized: GenericListener =
      typeof listener === "function" ? (listener as GenericListener) : (event: Event) => listener.handleEvent(event);
    const current = this.listeners.get(type) ?? [];
    current.push(normalized);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized: GenericListener =
      typeof listener === "function" ? (listener as GenericListener) : (event: Event) => listener.handleEvent(event);
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter((entry) => entry !== normalized),
    );
  }

  dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeDockSplitter {
  readonly dataset: DOMStringMap;
  readonly parentElement: { getBoundingClientRect: () => DOMRect };
  private readonly listeners = new Map<string, PointerListener[]>();
  private activePointerId: number | null = null;

  constructor(splitId: string, orientation: DockOrientation, size: { width: number; height: number }) {
    this.dataset = {
      dockSplitter: "true",
      dockSplitId: splitId,
      dockOrientation: orientation,
    };
    this.parentElement = {
      getBoundingClientRect: () =>
        ({
          left: 0,
          top: 0,
          right: size.width,
          bottom: size.height,
          width: size.width,
          height: size.height,
        }) as DOMRect,
    };
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized =
      typeof listener === "function"
        ? (listener as PointerListener)
        : (event: PointerEvent) => listener.handleEvent(event as unknown as Event);
    const current = this.listeners.get(type) ?? [];
    current.push(normalized);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const normalized =
      typeof listener === "function"
        ? (listener as PointerListener)
        : (event: PointerEvent) => listener.handleEvent(event as unknown as Event);
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter((entry) => entry !== normalized),
    );
  }

  setPointerCapture(pointerId: number): void {
    this.activePointerId = pointerId;
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.activePointerId === pointerId;
  }

  releasePointerCapture(pointerId: number): void {
    if (this.activePointerId === pointerId) {
      this.activePointerId = null;
    }
  }

  dispatch(
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "lostpointercapture",
    event: PointerEvent,
  ): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeRoot {
  private readonly classes = new Set<string>();
  private readonly attributes = new Map<string, string>();
  readonly ownerDocument: { defaultView: FakeWindow };

  readonly classList = {
    add: (name: string) => {
      this.classes.add(name);
    },
    remove: (name: string) => {
      this.classes.delete(name);
    },
    contains: (name: string) => this.classes.has(name),
  };

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  constructor(
    private readonly splitter: FakeDockSplitter,
    fakeWindow: FakeWindow,
  ) {
    this.ownerDocument = { defaultView: fakeWindow };
  }

  querySelectorAll<T>(selector: string): T[] {
    if (selector === "[data-dock-splitter='true'][data-dock-split-id][data-dock-orientation]") {
      return [this.splitter] as unknown as T[];
    }

    return [];
  }
}

function pointerEvent(input: { button?: number; pointerId: number; clientX: number; clientY: number }): PointerEvent {
  return {
    button: input.button ?? 0,
    pointerId: input.pointerId,
    clientX: input.clientX,
    clientY: input.clientY,
  } as PointerEvent;
}

function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, {
    tabId: "tab-b",
    groupId: "group-main",
    closePolicy: "closeable",
  });
  state = moveTabInDockTree(state, {
    tabId: "tab-b",
    targetTabId: "tab-a",
    zone: "right",
  });

  const runtime = {
    contextState: state,
    ...createWorkspacePersistenceFixture(state),
    contextPersistence: {
      save(nextState: ShellContextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;

  return runtime;
}

function readRootSplit(
  runtime: ShellRuntime,
): Extract<NonNullable<ShellContextState["dockTree"]["root"]>, { kind: "split" }> {
  const root = runtime.contextState.dockTree.root;
  if (!root || root.kind !== "split") {
    throw new Error("expected split root for splitter drag spec");
  }

  return root;
}

export function registerDockSplitterDragSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("dock splitter drag updates horizontal ratio by clientX delta", () => {
    const runtime = createRuntime();
    const splitId = readRootSplit(runtime).id;
    const fakeWindow = new FakeWindow();
    const splitter = new FakeDockSplitter(splitId, "horizontal", { width: 1000, height: 600 });
    const root = new FakeRoot(splitter, fakeWindow);
    let previewSplitStyleCalls = 0;
    let commitRenderCalls = 0;

    wireDockSplitterDrag(root as unknown as HTMLElement, runtime, {
      previewSplitStyle() {
        previewSplitStyleCalls += 1;
      },
      commitRender() {
        commitRenderCalls += 1;
      },
    });

    splitter.dispatch("pointerdown", pointerEvent({ pointerId: 1, clientX: 500, clientY: 10 }));
    fakeWindow.dispatch("pointermove", pointerEvent({ pointerId: 1, clientX: 650, clientY: 10 }));
    assertEqual(previewSplitStyleCalls, 1, "horizontal drag should preview split style on move");
    assertEqual(commitRenderCalls, 0, "horizontal drag should avoid full render while moving");
    fakeWindow.dispatch("pointerup", pointerEvent({ pointerId: 1, clientX: 650, clientY: 10 }));

    assertEqual(
      readDockSplitRatio(readRootSplit(runtime)),
      0.65,
      "horizontal drag should adjust ratio from x-axis delta",
    );
    assertEqual(commitRenderCalls, 1, "horizontal drag should rerender once after drag commit");
    assertTruthy(
      root.classList.contains("is-dock-splitter-dragging") === false,
      "dragging class should clear on pointerup",
    );
  });

  test("dock splitter drag uses vertical clientY axis for vertical orientation", () => {
    const runtime = createRuntime();
    const splitId = readRootSplit(runtime).id;
    const fakeWindow = new FakeWindow();
    const splitter = new FakeDockSplitter(splitId, "vertical", { width: 1000, height: 1000 });
    const root = new FakeRoot(splitter, fakeWindow);

    wireDockSplitterDrag(root as unknown as HTMLElement, runtime, {
      previewSplitStyle() {},
      commitRender() {},
    });

    splitter.dispatch("pointerdown", pointerEvent({ pointerId: 2, clientX: 100, clientY: 500 }));
    fakeWindow.dispatch("pointermove", pointerEvent({ pointerId: 2, clientX: 900, clientY: 350 }));
    fakeWindow.dispatch("pointerup", pointerEvent({ pointerId: 2, clientX: 900, clientY: 350 }));

    assertEqual(readDockSplitRatio(readRootSplit(runtime)), 0.35, "vertical drag should use y-axis delta only");
  });

  test("dock splitter drag clamps ratio and ignores non-primary pointer button", () => {
    const runtime = createRuntime();
    const splitId = readRootSplit(runtime).id;
    const fakeWindow = new FakeWindow();
    const splitter = new FakeDockSplitter(splitId, "horizontal", { width: 1000, height: 600 });
    const root = new FakeRoot(splitter, fakeWindow);

    wireDockSplitterDrag(root as unknown as HTMLElement, runtime, {
      previewSplitStyle() {},
      commitRender() {},
    });

    splitter.dispatch("pointerdown", pointerEvent({ button: 2, pointerId: 3, clientX: 500, clientY: 0 }));
    fakeWindow.dispatch("pointermove", pointerEvent({ pointerId: 3, clientX: 900, clientY: 0 }));
    assertEqual(readDockSplitRatio(readRootSplit(runtime)), 0.5, "right-click should not start drag or change ratio");

    splitter.dispatch("pointerdown", pointerEvent({ pointerId: 4, clientX: 500, clientY: 0 }));
    fakeWindow.dispatch("pointermove", pointerEvent({ pointerId: 4, clientX: 1600, clientY: 0 }));
    fakeWindow.dispatch("pointerup", pointerEvent({ pointerId: 4, clientX: 1600, clientY: 0 }));
    assertEqual(readDockSplitRatio(readRootSplit(runtime)), 0.85, "drag should clamp to upper ratio bound");
  });

  test("dock splitter drag cleanup runs on pointercancel and lostpointercapture", () => {
    const runtime = createRuntime();
    const splitId = readRootSplit(runtime).id;
    const fakeWindow = new FakeWindow();
    const splitter = new FakeDockSplitter(splitId, "horizontal", { width: 1000, height: 600 });
    const root = new FakeRoot(splitter, fakeWindow);

    wireDockSplitterDrag(root as unknown as HTMLElement, runtime, {
      previewSplitStyle() {},
      commitRender() {},
    });

    splitter.dispatch("pointerdown", pointerEvent({ pointerId: 11, clientX: 500, clientY: 0 }));
    assertTruthy(root.classList.contains("is-dock-splitter-dragging"), "dragging class should set on pointerdown");
    assertTruthy(root.hasAttribute("data-dock-splitter-drag-active"), "splitter active attr should set on pointerdown");

    fakeWindow.dispatch("pointercancel", pointerEvent({ pointerId: 11, clientX: 500, clientY: 0 }));
    assertTruthy(
      root.classList.contains("is-dock-splitter-dragging") === false,
      "dragging class should clear on pointercancel",
    );
    assertTruthy(
      root.hasAttribute("data-dock-splitter-drag-active") === false,
      "splitter active attr should clear on pointercancel",
    );

    splitter.dispatch("pointerdown", pointerEvent({ pointerId: 12, clientX: 500, clientY: 0 }));
    assertTruthy(root.hasAttribute("data-dock-splitter-drag-active"), "splitter active attr should set for next drag");
    splitter.dispatch("lostpointercapture", pointerEvent({ pointerId: 12, clientX: 500, clientY: 0 }));
    assertTruthy(
      root.classList.contains("is-dock-splitter-dragging") === false,
      "dragging class should clear on lostpointercapture",
    );
    assertTruthy(
      root.hasAttribute("data-dock-splitter-drag-active") === false,
      "splitter active attr should clear on lostpointercapture",
    );
  });

  test("dock splitter drag does not commit render when split ratio stays unchanged", () => {
    const runtime = createRuntime();
    const splitId = readRootSplit(runtime).id;
    const fakeWindow = new FakeWindow();
    const splitter = new FakeDockSplitter(splitId, "horizontal", { width: 1000, height: 600 });
    const root = new FakeRoot(splitter, fakeWindow);
    let previewSplitStyleCalls = 0;
    let commitRenderCalls = 0;

    wireDockSplitterDrag(root as unknown as HTMLElement, runtime, {
      previewSplitStyle() {
        previewSplitStyleCalls += 1;
      },
      commitRender() {
        commitRenderCalls += 1;
      },
    });

    splitter.dispatch("pointerdown", pointerEvent({ pointerId: 5, clientX: 500, clientY: 10 }));
    fakeWindow.dispatch("pointermove", pointerEvent({ pointerId: 5, clientX: 500, clientY: 10 }));
    fakeWindow.dispatch("pointerup", pointerEvent({ pointerId: 5, clientX: 500, clientY: 10 }));

    assertEqual(previewSplitStyleCalls, 0, "unchanged ratio should skip split style preview");
    assertEqual(commitRenderCalls, 0, "unchanged ratio should skip full render on cleanup");
  });
}
