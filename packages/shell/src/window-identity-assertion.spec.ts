import { describe, expect, it } from "vitest";

/**
 * Tests the window identity assertion logic that lives in create-ghost-shell.ts start().
 * We test the condition directly rather than importing the full shell graph.
 */

function assertWindowIdentityMatch(
  windowId: string,
  scomp: { participantId: string } | undefined,
): void {
  if (scomp && scomp.participantId !== windowId) {
    throw new Error(
      `Window identity mismatch: runtime.windowId="${windowId}" but scomp.participantId="${scomp.participantId}". ` +
        `The app layer must pass the same windowId to both createShellRuntime and scomp transport initialization.`,
    );
  }
}

describe("window identity assertion", () => {
  it("throws when scomp.participantId does not match runtime.windowId", () => {
    expect(() => assertWindowIdentityMatch("window-abc", { participantId: "wrong-id" })).toThrow(
      "Window identity mismatch",
    );
  });

  it("does not throw when scomp.participantId matches runtime.windowId", () => {
    expect(() =>
      assertWindowIdentityMatch("window-abc", { participantId: "window-abc" }),
    ).not.toThrow();
  });

  it("does not throw when scomp is undefined", () => {
    expect(() => assertWindowIdentityMatch("window-abc", undefined)).not.toThrow();
  });
});
