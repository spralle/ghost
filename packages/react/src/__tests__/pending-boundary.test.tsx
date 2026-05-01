import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GhostPendingBoundary } from "../GhostPendingBoundary.js";

describe("GhostPendingBoundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows children when not pending", () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(GhostPendingBoundary, {
          isPending: false,
          pendingMs: 200,
          pendingFallback: createElement("div", null, "Loading..."),
          children: createElement("div", null, "Content"),
        }),
      );
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["Content"] });
  });

  it("does not show fallback before pendingMs", () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(GhostPendingBoundary, {
          isPending: true,
          pendingMs: 200,
          pendingFallback: createElement("div", null, "Loading..."),
          children: createElement("div", null, "Content"),
        }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["Content"] });
  });

  it("shows fallback after pendingMs when still pending", () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(GhostPendingBoundary, {
          isPending: true,
          pendingMs: 200,
          pendingFallback: createElement("div", null, "Loading..."),
          children: createElement("div", null, "Content"),
        }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["Loading..."] });
  });

  it("hides fallback when pending becomes false", () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(GhostPendingBoundary, {
          isPending: true,
          pendingMs: 200,
          pendingFallback: createElement("div", null, "Loading..."),
          children: createElement("div", null, "Content"),
        }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["Loading..."] });

    act(() => {
      renderer!.update(
        createElement(GhostPendingBoundary, {
          isPending: false,
          pendingMs: 200,
          pendingFallback: createElement("div", null, "Loading..."),
          children: createElement("div", null, "Content"),
        }),
      );
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["Content"] });
  });
});
