import { describe, expect, it, vi } from "vitest";

import type { NavigationEvent, NavigationEventSink } from "../core/navigation-observer.js";
import {
  createConsoleNavigationSink,
  createNavigationObserver,
  sanitizeTarget,
} from "../core/navigation-observer.js";
import type { NavigationTarget } from "../core/types.js";

function makeEvent(overrides: Partial<NavigationEvent> = {}): NavigationEvent {
  return {
    type: "navigation_start",
    timestamp: Date.now(),
    source: "user-click",
    target: { type: "route", id: "test.route", argCount: 0 },
    ...overrides,
  };
}

function makeSink(id = "test"): NavigationEventSink & { events: NavigationEvent[] } {
  const events: NavigationEvent[] = [];
  return { id, events, onEvent: (e) => events.push(e) };
}

describe("createNavigationObserver", () => {
  it("emits without error when no sinks registered", () => {
    const observer = createNavigationObserver();
    expect(() => observer.emit(makeEvent())).not.toThrow();
  });

  it("dispatches events to registered sink", () => {
    const observer = createNavigationObserver();
    const sink = makeSink();
    observer.addSink(sink);
    const event = makeEvent();
    observer.emit(event);
    expect(sink.events).toEqual([event]);
  });

  it("dispatches to multiple sinks", () => {
    const observer = createNavigationObserver();
    const sink1 = makeSink("a");
    const sink2 = makeSink("b");
    observer.addSink(sink1);
    observer.addSink(sink2);
    const event = makeEvent();
    observer.emit(event);
    expect(sink1.events).toHaveLength(1);
    expect(sink2.events).toHaveLength(1);
  });

  it("removed sink stops receiving events", () => {
    const observer = createNavigationObserver();
    const sink = makeSink();
    const dispose = observer.addSink(sink);
    observer.emit(makeEvent());
    dispose();
    observer.emit(makeEvent());
    expect(sink.events).toHaveLength(1);
  });

  it("sink error does not crash observer or block other sinks", () => {
    const observer = createNavigationObserver();
    const badSink: NavigationEventSink = {
      id: "bad",
      onEvent() {
        throw new Error("boom");
      },
    };
    const goodSink = makeSink();
    observer.addSink(badSink);
    observer.addSink(goodSink);
    expect(() => observer.emit(makeEvent())).not.toThrow();
    expect(goodSink.events).toHaveLength(1);
  });
});

describe("sanitizeTarget", () => {
  it("strips param values from route target", () => {
    const target: NavigationTarget = { route: "vessel.detail", params: { vesselId: "secret123" } };
    const result = sanitizeTarget(target);
    expect(result).toEqual({ type: "route", id: "vessel.detail", argCount: 1 });
  });

  it("strips fact values from intent target", () => {
    const target: NavigationTarget = {
      intent: "domain.entity.open",
      facts: { entityType: "vessel", entityId: "v123" },
    };
    const result = sanitizeTarget(target);
    expect(result).toEqual({ type: "intent", id: "domain.entity.open", argCount: 2 });
  });
});

describe("createConsoleNavigationSink", () => {
  it("logs event via console.debug", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const sink = createConsoleNavigationSink();
    sink.onEvent(makeEvent({ type: "navigation_complete", durationMs: 42 }));
    expect(spy).toHaveBeenCalledWith("[nav:navigation_complete] route:test.route (42ms)", "user-click");
    spy.mockRestore();
  });
});
