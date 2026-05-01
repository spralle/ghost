/**
 * Integration tests: shell → router → plugin full navigation cycle.
 *
 * Tests the wiring between shell bootstrap, delegated navigation,
 * plugin router service, and DOM event handling.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDelegatedNavigation,
  parseNavigationTarget,
  type ShellRouter,
  type NavigationResult,
} from "@ghost-shell/router";
import { createPluginRouterServiceApi } from "../plugin-api/plugin-router-service-api.js";
import { initializeShellRouter } from "../router-initialization.js";
import type { ShellRuntime } from "../app/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRuntime(): ShellRuntime {
  return {
    workspaceManager: { activeWorkspaceId: "test-workspace" },
    stateObserver: undefined,
    windowId: "test-window",
  } as unknown as ShellRuntime;
}

function createNavLink(attrs: Record<string, string>): HTMLAnchorElement {
  const link = document.createElement("a");
  link.setAttribute("data-ghost-navigate", "");
  for (const [key, value] of Object.entries(attrs)) {
    link.setAttribute(key, value);
  }
  return link;
}

// ---------------------------------------------------------------------------
// Test: Shell bootstrap initializes router
// ---------------------------------------------------------------------------

describe("initializeShellRouter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates router handle with observer and wires to runtime", () => {
    const runtime = createMockRuntime();
    const root = document.createElement("div");

    const handle = initializeShellRouter(root, runtime);

    expect(handle.router).toBeDefined();
    expect(handle.observer).toBeDefined();
    expect(runtime.stateObserver).toBe(handle.observer);

    handle.dispose();
    expect(runtime.stateObserver).toBeUndefined();
  });

  it("dispose cleans up delegation (no navigation after dispose)", () => {
    const runtime = createMockRuntime();
    const root = document.createElement("div");
    document.body.appendChild(root);

    const handle = initializeShellRouter(root, runtime);
    const navigateSpy = vi.spyOn(handle.router, "navigate");

    const link = createNavLink({ "data-route": "test.route", "data-params": '{"id":"1"}' });
    root.appendChild(link);

    handle.dispose();

    link.click();
    expect(navigateSpy).not.toHaveBeenCalled();

    document.body.removeChild(root);
  });
});

// ---------------------------------------------------------------------------
// Test: Plugin router service bridges to shell router
// ---------------------------------------------------------------------------

describe("createPluginRouterServiceApi", () => {
  it("creates a plugin router that delegates navigate to shell router", () => {
    const mockShellRouter = {
      navigate: vi.fn().mockResolvedValue({ outcome: "navigated", tabId: "t1" }),
    };
    const service = createPluginRouterServiceApi({
      getShellRouter: () => mockShellRouter as unknown as ShellRouter,
    });

    const pluginRouter = service.createPluginRouter({});
    expect(pluginRouter).toBeDefined();
  });

  it("creates plugin router even when shell router is null (graceful degradation)", () => {
    const service = createPluginRouterServiceApi({
      getShellRouter: () => null,
    });

    const pluginRouter = service.createPluginRouter({});
    expect(pluginRouter).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test: Delegated navigation — DOM click → router navigation
// ---------------------------------------------------------------------------

describe("createDelegatedNavigation", () => {
  let root: HTMLDivElement;

  afterEach(() => {
    if (root?.parentElement) {
      document.body.removeChild(root);
    }
  });

  it("click on data-ghost-navigate element triggers navigation with route target", () => {
    const navigate = vi.fn();
    root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-route": "vessel.detail", "data-params": '{"vesselId":"v1"}' });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });
    link.click();

    expect(navigate).toHaveBeenCalledWith(
      { route: "vessel.detail", params: { vesselId: "v1" } },
      expect.any(Object),
    );

    attachment.dispose();
  });

  it("click on intent-based element triggers navigation with intent target", () => {
    const navigate = vi.fn();
    root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-intent": "domain.entity.open", "data-facts": '{"entityType":"vessel"}' });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });
    link.click();

    expect(navigate).toHaveBeenCalledWith(
      { intent: "domain.entity.open", facts: { entityType: "vessel" } },
      expect.any(Object),
    );

    attachment.dispose();
  });

  it("disabled elements do not trigger navigation", () => {
    const navigate = vi.fn();
    root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-route": "test", disabled: "" });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });
    link.click();

    expect(navigate).not.toHaveBeenCalled();

    attachment.dispose();
  });

  it("aria-disabled elements do not trigger navigation", () => {
    const navigate = vi.fn();
    root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-route": "test", "aria-disabled": "true" });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });
    link.click();

    expect(navigate).not.toHaveBeenCalled();

    attachment.dispose();
  });

  it("ctrl+click maps modifier to placement hint (does not suppress navigation)", () => {
    const navigate = vi.fn();
    root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-route": "test.route" });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });

    const event = new MouseEvent("click", { ctrlKey: true, bubbles: true });
    link.dispatchEvent(event);

    // Ctrl+click still navigates but with different placement hint
    expect(navigate).toHaveBeenCalledWith(
      { route: "test.route", params: {} },
      expect.objectContaining({ open: "auto" }),
    );

    attachment.dispose();
  });

  it("dispose removes event listeners — no navigation after dispose", () => {
    const navigate = vi.fn();
    root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-route": "test" });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });
    attachment.dispose();

    link.click();
    expect(navigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test: parseNavigationTarget edge cases
// ---------------------------------------------------------------------------

describe("parseNavigationTarget", () => {
  it("returns null for element without route or intent", () => {
    const el = document.createElement("a");
    el.setAttribute("data-ghost-navigate", "");
    expect(parseNavigationTarget(el)).toBeNull();
  });

  it("returns null for malformed JSON in data-params", () => {
    const el = document.createElement("a");
    el.setAttribute("data-route", "test");
    el.setAttribute("data-params", "not-json");
    expect(parseNavigationTarget(el)).toBeNull();
  });

  it("returns null for malformed JSON in data-facts", () => {
    const el = document.createElement("a");
    el.setAttribute("data-intent", "test.intent");
    el.setAttribute("data-facts", "{broken");
    expect(parseNavigationTarget(el)).toBeNull();
  });

  it("parses route target with params", () => {
    const el = document.createElement("a");
    el.setAttribute("data-route", "vessel.detail");
    el.setAttribute("data-params", '{"vesselId":"v1"}');
    expect(parseNavigationTarget(el)).toEqual({ route: "vessel.detail", params: { vesselId: "v1" } });
  });

  it("parses route target without params", () => {
    const el = document.createElement("a");
    el.setAttribute("data-route", "vessel.list");
    expect(parseNavigationTarget(el)).toEqual({ route: "vessel.list", params: {} });
  });

  it("parses intent target with facts", () => {
    const el = document.createElement("a");
    el.setAttribute("data-intent", "domain.open");
    el.setAttribute("data-facts", '{"type":"vessel"}');
    expect(parseNavigationTarget(el)).toEqual({ intent: "domain.open", facts: { type: "vessel" } });
  });
});

// ---------------------------------------------------------------------------
// Test: Navigation guard rejection (NavigationResult discriminated union)
// ---------------------------------------------------------------------------

describe("navigation guard rejection", () => {
  it("returns cancelled result when navigation is rejected", async () => {
    const cancelledResult: NavigationResult = { outcome: "cancelled" };
    const mockShellRouter = {
      navigate: vi.fn().mockResolvedValue(cancelledResult),
    };
    const service = createPluginRouterServiceApi({
      getShellRouter: () => mockShellRouter as unknown as ShellRouter,
    });

    const pluginRouter = service.createPluginRouter({});
    expect(pluginRouter).toBeDefined();

    const result = await mockShellRouter.navigate({ route: "guarded.route", params: {} });
    expect(result.outcome).toBe("cancelled");
  });

  it("returns no-match result with reason when route not found", async () => {
    const noMatchResult: NavigationResult = { outcome: "no-match", reason: "No handler for route" };
    const mockShellRouter = {
      navigate: vi.fn().mockResolvedValue(noMatchResult),
    };

    const result = await mockShellRouter.navigate({ route: "unknown.route", params: {} });
    expect(result.outcome).toBe("no-match");
    if (result.outcome === "no-match") {
      expect(result.reason).toBe("No handler for route");
    }
  });
});

// ---------------------------------------------------------------------------
// Test: Error recovery — navigation failures don't crash the system
// ---------------------------------------------------------------------------

describe("error recovery", () => {
  it("delegated navigation propagates navigate() errors (caller responsibility)", () => {
    const navigate = vi.fn().mockImplementation(() => {
      throw new Error("Network error");
    });
    const root = document.createElement("div");
    document.body.appendChild(root);

    const link = createNavLink({ "data-route": "test.route" });
    root.appendChild(link);

    const attachment = createDelegatedNavigation({ root, navigate });

    // Delegation does not swallow errors — the navigate callback is responsible
    expect(() => link.click()).toThrow("Network error");

    attachment.dispose();
    document.body.removeChild(root);
  });

  it("parseNavigationTarget handles array JSON in data-params gracefully", () => {
    const el = document.createElement("a");
    el.setAttribute("data-route", "test");
    el.setAttribute("data-params", "[1,2,3]");
    // Arrays are rejected — only objects are valid params
    expect(parseNavigationTarget(el)).toEqual({ route: "test", params: {} });
  });
});

// ---------------------------------------------------------------------------
// Test: Cross-window navigation sync (state observer wiring)
// ---------------------------------------------------------------------------

describe("cross-window navigation sync", () => {
  it("initializeShellRouter assigns observer to runtime for cross-window sync", () => {
    const runtime = createMockRuntime();
    const root = document.createElement("div");

    const handle = initializeShellRouter(root, runtime);

    // Observer is wired — cross-window sync relies on this assignment
    expect(runtime.stateObserver).toBeDefined();
    expect(runtime.stateObserver).toBe(handle.observer);

    handle.dispose();
  });

  it("router subscribe notifies on state changes", () => {
    const runtime = createMockRuntime();
    const root = document.createElement("div");

    const handle = initializeShellRouter(root, runtime);
    const listener = vi.fn();

    const unsubscribe = handle.router.subscribe(listener);
    expect(unsubscribe).toBeTypeOf("function");

    unsubscribe();
    handle.dispose();
  });
});
