import { describe, expect, test } from "vitest";
import { createActiveViewCodec } from "../codec/active-view-codec.js";
import type { UrlCodecState } from "../codec/codec-types.js";

function urlWithEncodedState(state: unknown): URL {
  const base64 = btoa(JSON.stringify(state));
  const encoded = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return new URL(`http://localhost/view?_s=${encoded}`);
}

describe("createActiveViewCodec", () => {
  const codec = createActiveViewCodec();

  test("has id 'active-view'", () => {
    expect(codec.id).toBe("active-view");
  });

  test("encode puts definitionId in path", () => {
    const state: UrlCodecState = {
      workspaceId: "ws-1",
      activeTabId: "tab-1",
      activeDefinitionId: "vessel-view",
      activeArgs: { vesselId: "v123" },
      tabSummary: [{ id: "tab-1", definitionId: "vessel-view", args: { vesselId: "v123" } }],
      dockTreeSnapshot: null,
    };
    const url = codec.encode(state, new URL("http://localhost"));
    expect(url.pathname).toBe("/vessel-view");
    expect(url.searchParams.get("vesselId")).toBe("v123");
  });

  test("encode includes _s state param", () => {
    const state: UrlCodecState = {
      workspaceId: "ws-1",
      activeTabId: "tab-1",
      activeDefinitionId: "view-a",
      activeArgs: {},
      tabSummary: [],
      dockTreeSnapshot: null,
    };
    const url = codec.encode(state, new URL("http://localhost"));
    expect(url.searchParams.has("_s")).toBe(true);
  });

  test("encode handles null activeDefinitionId", () => {
    const state: UrlCodecState = {
      workspaceId: "ws-1",
      activeTabId: null,
      activeDefinitionId: null,
      activeArgs: {},
      tabSummary: [],
      dockTreeSnapshot: null,
    };
    const url = codec.encode(state, new URL("http://localhost"));
    expect(url.pathname).toBe("/");
  });

  test("decode extracts definitionId from path", () => {
    const url = new URL("http://localhost/vessel-view?vesselId=v123");
    const result = codec.decode(url);
    expect(result).not.toBeNull();
    expect(result?.activeDefinitionId).toBe("vessel-view");
    expect(result?.activeArgs).toEqual({ vesselId: "v123" });
  });

  test("decode extracts workspaceId from _s param", () => {
    const state: UrlCodecState = {
      workspaceId: "ws-42",
      activeTabId: "tab-1",
      activeDefinitionId: "my-view",
      activeArgs: {},
      tabSummary: [],
      dockTreeSnapshot: null,
    };
    const encoded = codec.encode(state, new URL("http://localhost"));
    const decoded = codec.decode(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.workspaceId).toBe("ws-42");
  });

  test("decode accepts a string workspaceId from untrusted state", () => {
    const decoded = codec.decode(urlWithEncodedState({ workspaceId: "workspace-safe" }));

    expect(decoded?.workspaceId).toBe("workspace-safe");
  });

  test.each([
    ["object", { workspaceId: { tenant: "other" } }],
    ["number", { workspaceId: 42 }],
    ["null", { workspaceId: null }],
    ["boolean", { workspaceId: true }],
    ["absent", { tabs: [] }],
  ])("decode rejects a %s workspaceId from untrusted state", (_label, state) => {
    const decoded = codec.decode(urlWithEncodedState(state));

    expect(decoded?.activeDefinitionId).toBe("view");
    expect(decoded?.workspaceId).toBeUndefined();
  });

  test("state encoding is runtime-neutral and preserves Unicode", () => {
    const state: UrlCodecState = {
      workspaceId: "arbetsyta-åäö",
      activeTabId: "tab-1",
      activeDefinitionId: null,
      activeArgs: {},
      tabSummary: [],
      dockTreeSnapshot: null,
    };

    const decoded = codec.decode(codec.encode(state, new URL("http://localhost")));

    expect(decoded?.workspaceId).toBe("arbetsyta-åäö");
  });

  test("malformed state does not prevent route decoding", () => {
    const decoded = codec.decode(new URL("http://localhost/view?_s=not*base64"));

    expect(decoded?.activeDefinitionId).toBe("view");
    expect(decoded?.workspaceId).toBeUndefined();
  });

  test("decode ignores _s query param from activeArgs", () => {
    const url = new URL("http://localhost/view?foo=bar&_s=abc123");
    const result = codec.decode(url);
    expect(result?.activeArgs).toEqual({ foo: "bar" });
  });

  test("canDecode returns true for non-empty path", () => {
    expect(codec.canDecode(new URL("http://localhost/some-view"))).toBe(true);
  });

  test("canDecode returns false for root path", () => {
    expect(codec.canDecode(new URL("http://localhost/"))).toBe(false);
  });

  test("encode/decode round-trips activeDefinitionId and args", () => {
    const state: UrlCodecState = {
      workspaceId: "ws-1",
      activeTabId: "tab-1",
      activeDefinitionId: "detail-view",
      activeArgs: { entityId: "e1", mode: "edit" },
      tabSummary: [{ id: "tab-1", definitionId: "detail-view", args: { entityId: "e1", mode: "edit" } }],
      dockTreeSnapshot: null,
    };
    const url = codec.encode(state, new URL("http://localhost"));
    const decoded = codec.decode(url);
    expect(decoded?.activeDefinitionId).toBe("detail-view");
    expect(decoded?.activeArgs).toEqual({ entityId: "e1", mode: "edit" });
  });
});
