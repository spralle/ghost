import { describe, it, expect, mock } from "bun:test";
import { createSnapshotManager } from "../src/snapshot-manager.js";
import type { SentinelStore, SentinelPrincipal, PermissionSnapshot } from "@sentinel-guard/core";
import type { SnapshotCache } from "../src/types.js";

function createMockStore(): SentinelStore {
  return {
    loadTuples: mock(() => Promise.resolve([])),
    loadTuplesFrom: mock(() => Promise.resolve([])),
    loadPolicies: mock(() => Promise.resolve([])),
    loadRoles: mock(() => Promise.resolve(["user"])),
  };
}

function createPrincipal(id = "user-1"): SentinelPrincipal {
  return {
    userId: id,
    tenantId: "tenant-1",
    roles: ["user"],
    partyIds: ["party-1"],
    orgChain: [],
  };
}

describe("createSnapshotManager", () => {
  it("build stores snapshot in cache and returns it", async () => {
    const store = createMockStore();
    const manager = createSnapshotManager({
      store,
      resourceTypes: ["document"],
    });

    const principal = createPrincipal();
    const snapshot = await manager.build(principal);

    expect(snapshot.principalId).toBe("user-1");
    expect(snapshot.tenantId).toBe("tenant-1");
    expect(manager.get("user-1")).toBe(snapshot);
  });

  it("invalidate removes from cache", async () => {
    const store = createMockStore();
    const manager = createSnapshotManager({
      store,
      resourceTypes: ["document"],
    });

    await manager.build(createPrincipal());
    manager.invalidate("user-1");

    expect(manager.get("user-1")).toBeUndefined();
  });

  it("invalidateByTenant removes all for that tenant", async () => {
    const store = createMockStore();
    const manager = createSnapshotManager({
      store,
      resourceTypes: ["document"],
    });

    await manager.build(createPrincipal("user-1"));
    await manager.build(createPrincipal("user-2"));

    manager.invalidateByTenant("tenant-1");

    expect(manager.get("user-1")).toBeUndefined();
    expect(manager.get("user-2")).toBeUndefined();
  });

  it("serialize produces valid JSON", async () => {
    const store = createMockStore();
    const manager = createSnapshotManager({
      store,
      resourceTypes: ["document"],
    });

    const snapshot = await manager.build(createPrincipal());
    const json = manager.serialize(snapshot);
    const parsed = JSON.parse(json);

    expect(parsed.principalId).toBe("user-1");
    expect(parsed.graphCone).toBeDefined();
    expect(parsed.graphCone.tuples).toBeDefined();
  });
});
