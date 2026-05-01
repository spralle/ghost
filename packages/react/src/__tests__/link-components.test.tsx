import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GhostLink } from "../GhostLink.js";
import { IntentLink } from "../IntentLink.js";
import { ViewLink } from "../ViewLink.js";
import { ActionLink } from "../ActionLink.js";

describe("GhostLink", () => {
  it("renders an anchor with data-ghost-navigate for route target", () => {
    const html = renderToStaticMarkup(
      createElement(GhostLink, {
        target: { route: "vessel.detail", params: { vesselId: "v1" } },
        children: "View",
      }),
    );
    expect(html).toContain("data-ghost-navigate");
    expect(html).toContain('data-route="vessel.detail"');
    expect(html).toContain("data-params");
    expect(html).toContain("vesselId");
    expect(html).toContain(">View</a>");
  });

  it("renders an anchor with data-ghost-navigate for intent target", () => {
    const html = renderToStaticMarkup(
      createElement(GhostLink, {
        target: { intent: "open.entity", facts: { id: "123" } },
        children: "Open",
      }),
    );
    expect(html).toContain('data-intent="open.entity"');
    expect(html).toContain("data-facts");
  });

  it("omits data-params when params are empty", () => {
    const html = renderToStaticMarkup(
      createElement(GhostLink, {
        target: { route: "home", params: {} },
        children: "Home",
      }),
    );
    expect(html).toContain('data-route="home"');
    expect(html).not.toContain("data-params");
  });

  it("includes open and history hints as data attributes", () => {
    const html = renderToStaticMarkup(
      createElement(GhostLink, {
        target: { route: "x", params: {} },
        hints: { open: "split", history: "replace" },
        children: "X",
      }),
    );
    expect(html).toContain('data-open="split"');
    expect(html).toContain('data-history="replace"');
  });

  it("resolves className function", () => {
    const html = renderToStaticMarkup(
      createElement(GhostLink, {
        target: { route: "x", params: {} },
        className: ({ isActive }) => (isActive ? "active" : "inactive"),
        children: "X",
      }),
    );
    expect(html).toContain('class="inactive"');
  });
});

describe("IntentLink", () => {
  it("renders GhostLink with intent target from token", () => {
    const token = { id: "test.intent", schema: {} as never, __facts: undefined as never, __result: undefined as never };
    const html = renderToStaticMarkup(
      createElement(IntentLink, {
        token,
        facts: { key: "value" },
        children: "Intent",
      }),
    );
    expect(html).toContain('data-intent="test.intent"');
    expect(html).toContain("data-facts");
    expect(html).toContain(">Intent</a>");
  });
});

describe("ViewLink", () => {
  it("renders GhostLink with route target from view token", () => {
    const token = { definitionId: "my.view", schema: {} as never, __args: undefined as never };
    const html = renderToStaticMarkup(
      createElement(ViewLink, {
        token,
        args: { tab: "info" },
        children: "View",
      }),
    );
    expect(html).toContain('data-route="my.view"');
    expect(html).toContain("data-params");
    expect(html).toContain(">View</a>");
  });
});

describe("ActionLink", () => {
  it("renders an anchor with role=button and data-ghost-action", () => {
    const token = { id: "do.thing", schema: {} as never, __args: undefined as never, __result: undefined as never };
    const html = renderToStaticMarkup(
      createElement(ActionLink, {
        token,
        args: { x: 1 },
        children: "Do",
      }),
    );
    expect(html).toContain('role="button"');
    expect(html).toContain('data-ghost-action="do.thing"');
    expect(html).toContain(">Do</a>");
  });
});
