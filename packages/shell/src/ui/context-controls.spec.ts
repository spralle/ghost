import { describe, expect, it } from "vitest";
import type { ShellRuntime } from "../app/types.js";
import { updateWindowReadOnlyState } from "./context-controls.js";

class FakeControl {
  readonly id: string;
  readonly dataset: DOMStringMap;

  private readonly attrs = new Map<string, string>();

  constructor(
    input: {
      id?: string;
      action?: string;
    } = {},
  ) {
    this.id = input.id ?? "";
    this.dataset = input.action ? { action: input.action } : {};
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
}

class FakeShellNode {
  readonly classNames = new Set<string>();

  readonly classList = {
    toggle: (className: string, force?: boolean) => {
      if (force === undefined) {
        if (this.classNames.has(className)) {
          this.classNames.delete(className);
        } else {
          this.classNames.add(className);
        }
        return;
      }

      if (force) {
        this.classNames.add(className);
      } else {
        this.classNames.delete(className);
      }
    },
  };

  constructor(private readonly controls: FakeControl[]) {}

  querySelectorAll<T>(_selector: string): T[] {
    return this.controls as unknown as T[];
  }
}

class FakeRoot {
  constructor(private readonly shellNode: FakeShellNode) {}

  querySelector<T>(selector: string): T | null {
    if (selector === "#shell-root") {
      return this.shellNode as unknown as T;
    }
    return null;
  }
}

function createRuntime(overrides: Partial<ShellRuntime> = {}): ShellRuntime {
  return {
    syncDegraded: false,
    syncDegradedReason: null,
    ...overrides,
  } as ShellRuntime;
}

describe("context-controls", () => {
  it("publish-failed degraded mode applies read-only styling and mutating control disablement", () => {
    const applyButton = new FakeControl({ id: "context-apply" });
    const input = new FakeControl({ id: "context-value-input" });
    const nonMutating = new FakeControl({ id: "some-other-control" });
    const shellNode = new FakeShellNode([applyButton, input, nonMutating]);
    const root = new FakeRoot(shellNode);

    updateWindowReadOnlyState(
      root as unknown as HTMLElement,
      createRuntime({
        syncDegraded: true,
        syncDegradedReason: "publish-failed",
      }),
    );

    expect(shellNode.classNames.has("sync-degraded")).toBe(true);
    expect(applyButton.getAttribute("disabled")).toBe("disabled");
    expect(input.getAttribute("disabled")).toBe("disabled");
    expect(nonMutating.getAttribute("disabled")).toBe(null);
  });

  it("unavailable bridge keeps shell interactive in local-only mode", () => {
    const applyButton = new FakeControl({ id: "context-apply" });
    const input = new FakeControl({ id: "context-value-input" });
    const nonMutating = new FakeControl({ id: "some-other-control" });
    const shellNode = new FakeShellNode([applyButton, input, nonMutating]);
    const root = new FakeRoot(shellNode);

    updateWindowReadOnlyState(
      root as unknown as HTMLElement,
      createRuntime({
        syncDegraded: true,
        syncDegradedReason: "unavailable",
      }),
    );

    expect(shellNode.classNames.has("sync-degraded")).toBe(false);
    expect(applyButton.getAttribute("disabled")).toBe(null);
    expect(input.getAttribute("disabled")).toBe(null);
    expect(nonMutating.getAttribute("disabled")).toBe(null);
  });
});
