import { describe, it, expect, mock } from "bun:test";
import { buildBatch } from "../batch-builder.js";
import type { SentinelStore, SentinelPrincipal } from "@ghost/sentinel";

function createMockStore(overrides: Partial<SentinelStore> = {}): SentinelStore {
  return {
    loadTuples: mock(() => Promise.resolve([])),
    loadTuplesFrom: mock(() => Promise.resolve([])),
    loadPolicies: mock(() => Promise.resolve([])),
    loadRoles: mock(() => Promise.resolve(["user"])),
    ...overrides,
  };
}

function createPrincipal(id: string): SentinelPrincipal {
  return {
    userId: id,
    tenantId: "tenant-1",
    roles: ["user"],
    partyIds: [],
    orgChain: [],
  };
}

describe("buildBatch", () => {
  it("builds snapshots for multiple principals", async () => {
    const store = createMockStore();
    const principals = Array.from({ length: 5 }, (_, i) => createPrincipal(`user-${i}`));

    const result = await buildBatch(principals, {
      store,
      resourceTypes: ["document"],
    });

    expect(result.snapshots.size).toBe(5);
    expect(result.errors.size).toBe(0);
    for (let i = 0; i < 5; i++) {
      expect(result.snapshots.get(`user-${i}`)).toBeDefined();
    }
  });

  it("fetches policies only once per resource type", async () => {
    const loadPolicies = mock(() => Promise.resolve([]));
    const store = createMockStore({ loadPolicies });
    const principals = [createPrincipal("user-1"), createPrincipal("user-2")];

    await buildBatch(principals, {
      store,
      resourceTypes: ["document", "task"],
    });

    // Pre-fetch: 2 calls (one per resource type), not 2*2
    expect(loadPolicies).toHaveBeenCalledTimes(2);
  });

  it("isolates errors - one failure does not block others", async () => {
    let callCount = 0;
    const loadRoles = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("fail"));
      return Promise.resolve(["user"]);
    });
    const store = createMockStore({ loadRoles });
    const principals = [createPrincipal("user-fail"), createPrincipal("user-ok")];

    const result = await buildBatch(principals, {
      store,
      resourceTypes: ["document"],
    });

    expect(result.errors.size).toBe(1);
    expect(result.errors.get("user-fail")).toBeDefined();
    expect(result.snapshots.size).toBe(1);
    expect(result.snapshots.get("user-ok")).toBeDefined();
  });

  it("respects concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    const loadRoles = mock(() => {
      active++;
      maxActive = Math.max(maxActive, active);
      return new Promise<string[]>((resolve) => {
        setTimeout(() => {
          active--;
          resolve(["user"]);
        }, 10);
      });
    });
    const store = createMockStore({ loadRoles });
    const principals = Array.from({ length: 10 }, (_, i) => createPrincipal(`user-${i}`));

    await buildBatch(principals, {
      store,
      resourceTypes: ["document"],
      concurrency: 3,
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // Confirm parallelism happened
  });
});
