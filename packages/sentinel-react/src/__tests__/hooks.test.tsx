import { expect, test, describe } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  SentinelProvider,
  useCan,
  useDataBlock,
  PermissionGate,
} from "../index";
import type { PermissionSnapshot, SentinelPrincipal, CompiledPolicy } from "@ghost/sentinel";
import { GraphSubset } from "@ghost/sentinel";

function makePolicy(rules: CompiledPolicy["rules"]): CompiledPolicy {
  return { rules };
}

function makeSnapshot(overrides?: Partial<PermissionSnapshot>): PermissionSnapshot {
  return {
    principalId: "user-1",
    tenantId: "tenant-1",
    resolvedRoles: ["admin"],
    compiledPolicy: makePolicy([
      {
        name: "allow-read",
        effect: "grant",
        target: { kind: "action", action: "read" },
        condition: {},
        salience: 100,
      },
    ]),
    graphCone: new GraphSubset([]),
    redactionMap: {
      profile: ["name", "email"],
    },
    timestamp: Date.now(),
    ttl: 3600000,
    ...overrides,
  };
}

function makePrincipal(): SentinelPrincipal {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    roles: ["admin"],
    partyIds: ["party-1"],
    orgChain: ["org-1"],
  };
}

/** Helper: renders a hook inside SentinelProvider using SSR */
function renderWithProvider(hookComponent: () => React.ReactNode): string {
  const snapshot = makeSnapshot();
  const principal = makePrincipal();
  return renderToString(
    createElement(SentinelProvider, { snapshot, principal }, hookComponent()),
  );
}

describe("SentinelProvider", () => {
  test("renders children", () => {
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(
        SentinelProvider,
        { snapshot, principal },
        createElement("div", null, "hello"),
      ),
    );
    expect(html).toContain("hello");
  });
});

describe("useCan", () => {
  test("returns allowed=true for granted action", () => {
    function TestComponent() {
      const { allowed } = useCan("read");
      return createElement("span", null, String(allowed));
    }
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(SentinelProvider, { snapshot, principal }, createElement(TestComponent)),
    );
    expect(html).toContain("true");
  });

  test("returns allowed=false for denied action", () => {
    function TestComponent() {
      const { allowed } = useCan("delete");
      return createElement("span", null, String(allowed));
    }
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(SentinelProvider, { snapshot, principal }, createElement(TestComponent)),
    );
    expect(html).toContain("false");
  });
});

describe("useDataBlock", () => {
  test("returns granted=true with fields for allowed block", () => {
    function TestComponent() {
      const { granted, fields } = useDataBlock("profile");
      return createElement("span", null, `${granted}:${fields.join(",")}`);
    }
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(SentinelProvider, { snapshot, principal }, createElement(TestComponent)),
    );
    expect(html).toContain("true:name,email");
  });

  test("returns granted=false for denied block", () => {
    function TestComponent() {
      const { granted, fields } = useDataBlock("secret");
      return createElement("span", null, `${granted}:${fields.length}`);
    }
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(SentinelProvider, { snapshot, principal }, createElement(TestComponent)),
    );
    expect(html).toContain("false:0");
  });
});

describe("PermissionGate", () => {
  test("renders children when allowed", () => {
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(
        SentinelProvider,
        { snapshot, principal },
        createElement(PermissionGate, { action: "read" }, createElement("span", null, "visible")),
      ),
    );
    expect(html).toContain("visible");
  });

  test("renders fallback when denied", () => {
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(
        SentinelProvider,
        { snapshot, principal },
        createElement(
          PermissionGate,
          { action: "delete", fallback: createElement("span", null, "denied") },
          createElement("span", null, "visible"),
        ),
      ),
    );
    expect(html).toContain("denied");
    expect(html).not.toContain("visible");
  });

  test("renders nothing when denied and no fallback", () => {
    const snapshot = makeSnapshot();
    const principal = makePrincipal();
    const html = renderToString(
      createElement(
        SentinelProvider,
        { snapshot, principal },
        createElement(PermissionGate, { action: "delete" }, createElement("span", null, "visible")),
      ),
    );
    expect(html).not.toContain("visible");
  });
});
