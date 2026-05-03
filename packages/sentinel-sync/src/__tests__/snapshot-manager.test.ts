import { describe, it, expect, mock } from "bun:test";
import { createSnapshotManager } from "../snapshot-manager.js";
import type { SentinelStore, SentinelPrincipal, PermissionSnapshot } from "@ghost/sentinel";
import type { SnapshotCache } from "../types.js";

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
    const result = await manager.build(principal);

    expect(result.stale).toBe(false);
    expect(result.snapshot.principalId).toBe("user-1");
    expect(result.snapshot.tenantId).toBe("tenant-1");
    expect(manager.get("user-1")).toBe(result.snapshot);
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
    const json = manager.serialize(snapshot.snapshot);
    const parsed = JSON.parse(json);

    expect(parsed.principalId).toBe("user-1");
    expect(parsed.graphCone).toBeDefined();
    expect(parsed.graphCone.tuples).toBeDefined();
  });

  it("returns stale snapshot on build error when cache has expired entry", async () => {
    const store = createMockStore();
    const onError = mock(() => {});
    const manager = createSnapshotManager({
      store,
      resourceTypes: ["document"],
      onError,
    });

    // Build a valid snapshot first
    const result = await manager.build(createPrincipal());
    expect(result.stale).toBe(false);

    // Make store throw on next build
    store.loadRoles = mock(() => Promise.reject(new Error("store down")));

    const fallback = await manager.build(createPrincipal());
    expect(fallback.stale).toBe(true);
    expect(fallback.snapshot.principalId).toBe("user-1");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("re-throws error when no cached snapshot available", async () => {
    const store = createMockStore();
    store.loadRoles = mock(() => Promise.reject(new Error("store down")));
    const onError = mock(() => {});
    const manager = createSnapshotManager({
      store,
      resourceTypes: ["document"],
      onError,
    });

    await expect(manager.build(createPrincipal())).rejects.toThrow("store down");
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
