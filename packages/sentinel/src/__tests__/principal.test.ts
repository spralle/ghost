import { describe, it, expect, mock } from "bun:test";
import {
  createPrincipal,
  impersonate,
  isImpersonated,
} from "../principal/index";
import {
  isExpired,
  needsRefresh,
  getTtlForRoles,
} from "../snapshot/snapshot-validator";
import { buildSnapshot } from "../snapshot/snapshot-builder";
import type { SentinelStore } from "../storage/sentinel-store";
import type { SentinelPrincipal } from "../principal/sentinel-principal";

describe("principal", () => {
  const basePrincipal: SentinelPrincipal = {
    userId: "user-1",
    tenantId: "tenant-1",
    roles: ["user"],
    partyIds: ["party-1"],
    orgChain: ["org-root", "org-child"],
  };

  it("createPrincipal returns frozen object", () => {
    const p = createPrincipal(basePrincipal);
    expect(Object.isFrozen(p)).toBe(true);
    expect(p.userId).toBe("user-1");
    expect(p.roles).toEqual(["user"]);
  });

  it("impersonate creates ImpersonatedPrincipal with target identity", () => {
    const target: SentinelPrincipal = {
      userId: "target-1",
      tenantId: "tenant-1",
      roles: ["tenant-admin"],
      partyIds: ["party-2"],
      orgChain: ["org-2"],
    };
    const result = impersonate(basePrincipal, target, "support ticket #123");
    expect(result.userId).toBe("target-1");
    expect(result.tenantId).toBe("tenant-1");
    expect(result.roles).toEqual(["tenant-admin"]);
  });

  it("impersonate carries original userId in impersonatedBy", () => {
    const target: SentinelPrincipal = {
      userId: "target-1",
      tenantId: "tenant-1",
      roles: ["user"],
      partyIds: [],
      orgChain: [],
    };
    const result = impersonate(basePrincipal, target, "testing");
    expect(result.impersonatedBy.userId).toBe("user-1");
    expect(result.impersonatedBy.tenantId).toBe("tenant-1");
    expect(result.impersonatedBy.reason).toBe("testing");
  });

  it("impersonate rejects cross-tenant impersonation", () => {
    const target: SentinelPrincipal = {
      userId: "target-1",
      tenantId: "tenant-2",
      roles: ["user"],
      partyIds: [],
      orgChain: [],
    };
    expect(() => impersonate(basePrincipal, target, "reason")).toThrow(
      "Cross-tenant impersonation is not allowed",
    );
  });

  it("isImpersonated correctly identifies impersonated principals", () => {
    const p = createPrincipal(basePrincipal);
    expect(isImpersonated(p)).toBe(false);

    const target: SentinelPrincipal = {
      userId: "target-1",
      tenantId: "tenant-1",
      roles: ["user"],
      partyIds: [],
      orgChain: [],
    };
    const imp = impersonate(basePrincipal, target, "reason");
    expect(isImpersonated(imp)).toBe(true);
  });
});

describe("snapshot-validator", () => {
  it("isExpired returns true for expired snapshots", () => {
    const snapshot = {
      principalId: "u1",
      tenantId: "t1",
      resolvedRoles: ["user"],
      compiledPolicy: { rules: [] },
      graphCone: { tuples: [] },
      redactionMap: {},
      timestamp: Date.now() - 10000,
      ttl: 5000,
    } as never;
    expect(isExpired(snapshot)).toBe(true);
  });

  it("isExpired returns false for valid snapshots", () => {
    const snapshot = {
      principalId: "u1",
      tenantId: "t1",
      resolvedRoles: ["user"],
      compiledPolicy: { rules: [] },
      graphCone: { tuples: [] },
      redactionMap: {},
      timestamp: Date.now(),
      ttl: 60000,
    } as never;
    expect(isExpired(snapshot)).toBe(false);
  });

  it("needsRefresh returns true when within 20% of TTL", () => {
    const ttl = 10000;
    const snapshot = {
      principalId: "u1",
      tenantId: "t1",
      resolvedRoles: ["user"],
      compiledPolicy: { rules: [] },
      graphCone: { tuples: [] },
      redactionMap: {},
      timestamp: Date.now() - 9000, // 1000ms left, threshold is 2000ms
      ttl,
    } as never;
    expect(needsRefresh(snapshot)).toBe(true);
  });

  it("getTtlForRoles returns shortest TTL for highest-priority role", () => {
    expect(getTtlForRoles(["user", "platform-ops"])).toBe(60 * 60 * 1000);
    expect(getTtlForRoles(["user", "tenant-admin"])).toBe(2 * 60 * 60 * 1000);
    expect(getTtlForRoles(["user"])).toBe(8 * 60 * 60 * 1000);
  });
});

describe("snapshot-builder", () => {
  it("buildSnapshot assembles all components", async () => {
    const mockStore: SentinelStore = {
      loadRoles: mock(() => Promise.resolve(["user"])),
      loadPolicies: mock(() =>
        Promise.resolve([{ resourceType: "document", action: "read", condition: {} }]),
      ),
      loadTuples: mock(() => Promise.resolve([])),
      loadTuplesFrom: mock(() => Promise.resolve([])),
    };

    const principal = createPrincipal({
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["user"],
      partyIds: [],
      orgChain: [],
    });

    const snapshot = await buildSnapshot(mockStore, principal, ["document"]);

    expect(snapshot.principalId).toBe("user-1");
    expect(snapshot.tenantId).toBe("tenant-1");
    expect(snapshot.resolvedRoles).toEqual(["user"]);
    expect(snapshot.compiledPolicy.rules.length).toBeGreaterThan(0);
    expect(snapshot.ttl).toBe(8 * 60 * 60 * 1000);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
