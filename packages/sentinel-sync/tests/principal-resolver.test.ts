import { describe, it, expect, mock } from "bun:test";
import { resolvePrincipal } from "../src/principal-resolver.js";
import type { SentinelStore } from "@sentinel-guard/core";
import type { EnrichedJwtPayload, PrincipalResolverOptions } from "../src/types.js";

function createMockStore(overrides: Partial<SentinelStore> = {}): SentinelStore {
  return {
    loadTuples: mock(() => Promise.resolve([])),
    loadTuplesFrom: mock(() => Promise.resolve([])),
    loadPolicies: mock(() => Promise.resolve([])),
    loadRoles: mock(() => Promise.resolve(["user"])),
    ...overrides,
  };
}

function createJwt(overrides: Partial<EnrichedJwtPayload> = {}): EnrichedJwtPayload {
  return {
    id: "user-1",
    tenant: "tenant-1",
    source: "accounts",
    name: "Test",
    surname: "User",
    emails: ["test@example.com"],
    ...overrides,
  };
}

describe("resolvePrincipal", () => {
  it("looks up partyIds from store when JWT has none", async () => {
    const loadTuples = mock(() =>
      Promise.resolve([
        { nodeType: "user", nodeId: "user-1", relation: "partyMember", targetType: "party", targetId: "party-1" },
        { nodeType: "user", nodeId: "user-1", relation: "partyMember", targetType: "party", targetId: "party-2" },
      ]),
    );
    const store = createMockStore({ loadTuples });
    const jwt = createJwt();

    const principal = await resolvePrincipal(jwt, { store });

    expect(principal.partyIds).toEqual(["party-1", "party-2"]);
    expect(loadTuples).toHaveBeenCalledWith("user", "user-1", "partyMember");
  });

  it("uses JWT partyIds when present and trustJwtPartyIds is true", async () => {
    const loadTuples = mock(() => Promise.resolve([]));
    const store = createMockStore({ loadTuples });
    const jwt = createJwt({ partyIds: ["jwt-party-1"] });

    const principal = await resolvePrincipal(jwt, { store, trustJwtPartyIds: true });

    expect(principal.partyIds).toEqual(["jwt-party-1"]);
    // loadTuples should not be called for partyMember
    const calls = (loadTuples as ReturnType<typeof mock>).mock.calls;
    const partyMemberCalls = calls.filter(
      (c: unknown[]) => c[2] === "partyMember",
    );
    expect(partyMemberCalls.length).toBe(0);
  });

  it("ignores JWT partyIds when trustJwtPartyIds is false", async () => {
    const loadTuples = mock(() => Promise.resolve([]));
    const store = createMockStore({ loadTuples });
    const jwt = createJwt({ partyIds: ["jwt-party-1"] });

    const principal = await resolvePrincipal(jwt, { store, trustJwtPartyIds: false });

    expect(principal.partyIds).toEqual([]);
    const calls = (loadTuples as ReturnType<typeof mock>).mock.calls;
    const partyMemberCalls = calls.filter(
      (c: unknown[]) => c[2] === "partyMember",
    );
    expect(partyMemberCalls.length).toBe(1);
  });

  it("uses JWT orgChain when present", async () => {
    const store = createMockStore();
    const jwt = createJwt({ orgChain: ["org-parent", "org-root"] });

    const principal = await resolvePrincipal(jwt, { store });

    expect(principal.orgChain).toEqual(["org-parent", "org-root"]);
  });

  it("passes through impersonation claims", async () => {
    const store = createMockStore();
    const jwt = createJwt({
      impersonatedBy: { userId: "admin-1", expires: 9999, originalToken: "tok" },
    });

    const principal = await resolvePrincipal(jwt, { store });

    expect(principal.claims?.impersonatedBy).toEqual({
      userId: "admin-1",
      expires: 9999,
      originalToken: "tok",
    });
  });
});
