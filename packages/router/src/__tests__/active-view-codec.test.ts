import { describe, expect, test } from "vitest";
import { createActiveViewCodec } from "../codec/active-view-codec.js";
import type { UrlCodecState } from "../codec/codec-types.js";

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
