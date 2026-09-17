import type { ShellRuntime } from "./app/types.js";
import {
  createIncomingTransferJournal,
  createInitialShellContextState,
  registerTab,
  type ShellContextState,
} from "./context-state.js";
import { createWorkspacePersistenceFixture } from "./test-fixtures/workspace-persistence-fixture.js";

interface DragDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (format: string, value: string) => void;
  getData: (format: string) => string;
}

type DragListener = (event: DragEvent) => void;

export class FakeOverlay {
  readonly classList = {
    add: (_className: string) => {},
    remove: (_className: string) => {},
  };

  contains(target: unknown): boolean {
    return target instanceof FakeDockZone;
  }
}

export class FakeDockZone {
  readonly dataset: DOMStringMap;
  private readonly listeners = new Map<string, DragListener[]>();
  private readonly overlay: FakeOverlay;

  constructor(targetTabId: string, zone: "left" | "right" | "top" | "bottom" | "center", overlay: FakeOverlay) {
    this.dataset = {
      dockDropZone: zone,
      targetTabId,
    };
    this.overlay = overlay;
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

  dispatch(type: "dragover" | "dragleave" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  closest(selector: string): FakeOverlay | null {
    if (selector === ".dock-drop-overlay") {
      return this.overlay;
    }

    return null;
  }
}

export class FakeDockRoot {
  private readonly classes = new Set<string>();
  private readonly attributes = new Map<string, string>();

  readonly classList = {
    add: (className: string) => {
      this.classes.add(className);
    },
    remove: (className: string) => {
      this.classes.delete(className);
    },
    contains: (className: string) => this.classes.has(className),
  };

  private readonly listeners = new Map<string, DragListener[]>();

  constructor(private readonly zones: FakeDockZone[]) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
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

  querySelectorAll<T>(selector: string): T[] {
    if (selector === "[data-dock-drop-zone][data-target-tab-id]") {
      return this.zones as unknown as T[];
    }

    return [];
  }

  dispatch(type: "dragend" | "drop", event: DragEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

type LocalBridgeEvent = Parameters<ShellRuntime["bridge"]["publish"]>[0];

export class MemoryDataTransfer implements DragDataTransfer {
  effectAllowed = "none";
  dropEffect = "none";
  private readonly data = new Map<string, string>();

  setData(format: string, value: string): void {
    this.data.set(format, value);
  }

  getData(format: string): string {
    return this.data.get(format) ?? "";
  }
}

export class EmptyReadDataTransfer extends MemoryDataTransfer {
  override getData(_format: string): string {
    return "";
  }
}

export function createDragEvent(dataTransfer: DragDataTransfer): DragEvent {
  let prevented = false;
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
    relatedTarget: null,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
    get defaultPrevented() {
      return prevented;
    },
  } as DragEvent;
}

export function createDragEventWithOptions(options: {
  dataTransfer?: DragDataTransfer | null;
  relatedTarget?: EventTarget | null;
}): DragEvent {
  let prevented = false;
  return {
    dataTransfer: (options.dataTransfer ?? null) as unknown as DataTransfer,
    relatedTarget: options.relatedTarget ?? null,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
    get defaultPrevented() {
      return prevented;
    },
  } as DragEvent;
}

export function createDockZone(
  targetTabId: string,
  zone: "left" | "right" | "top" | "bottom" | "center",
): FakeDockZone {
  return new FakeDockZone(targetTabId, zone, new FakeOverlay());
}

export function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, {
    tabId: "tab-b",
    groupId: "group-main",
    closePolicy: "closeable",
  });

  const runtime = {
    windowId: "window-a",
    syncDegraded: false,
    syncDegradedReason: null,
    contextState: state,
    ...createWorkspacePersistenceFixture(state),
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    pendingFocusSelector: null,
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
    bridge: {
      available: false,
      publish(_event: LocalBridgeEvent) {
        return false;
      },
      subscribe() {
        return () => {};
      },
      subscribeHealth() {
        return () => {};
      },
      recover() {},
    },
    contextPersistence: {
      save(nextState: ShellContextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;

  return runtime;
}
