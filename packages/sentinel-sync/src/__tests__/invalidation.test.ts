import { describe, it, expect, mock } from "bun:test";
import { createInvalidationProcessor } from "../invalidation.js";
import type { SnapshotManager, InvalidationHandler } from "../types.js";

function createMockManager(): SnapshotManager {
  return {
    build: mock(() => Promise.resolve({} as never)),
    get: mock(() => undefined),
    invalidate: mock(() => {}),
    invalidateByTenant: mock(() => {}),
    serialize: mock(() => "{}"),
  };
}

describe("createInvalidationProcessor", () => {
  it("debounces multiple events into one batch", async () => {
    const manager = createMockManager();
    const onInvalidate = mock(() => {});
    const handler: InvalidationHandler = { onInvalidate };

    const processor = createInvalidationProcessor({
      snapshotManager: manager,
      handler,
      debounceMs: 10,
    });

    processor.process({
      type: "role_assigned",
      tenantId: "t1",
      affectedPrincipalIds: ["user-1"],
      timestamp: Date.now(),
    });
    processor.process({
      type: "role_revoked",
      tenantId: "t1",
      affectedPrincipalIds: ["user-2"],
      timestamp: Date.now(),
    });
    processor.process({
      type: "policy_updated",
      tenantId: "t1",
      affectedPrincipalIds: ["user-1", "user-3"],
      timestamp: Date.now(),
    });

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 50));

    expect(onInvalidate).toHaveBeenCalledTimes(1);
    const call = (onInvalidate as ReturnType<typeof mock>).mock.calls[0];
    const ids = call[0] as string[];
    expect(ids).toContain("user-1");
    expect(ids).toContain("user-2");
    expect(ids).toContain("user-3");
    // Deduplicated
    expect(ids.filter((id: string) => id === "user-1").length).toBe(1);
  });

  it("flush forces immediate processing", () => {
    const manager = createMockManager();
    const onInvalidate = mock(() => {});
    const handler: InvalidationHandler = { onInvalidate };

    const processor = createInvalidationProcessor({
      snapshotManager: manager,
      handler,
      debounceMs: 10000, // Very long debounce
    });

    processor.process({
      type: "role_assigned",
      tenantId: "t1",
      affectedPrincipalIds: ["user-1"],
      timestamp: Date.now(),
    });

    processor.flush();

    expect(onInvalidate).toHaveBeenCalledTimes(1);
    expect(manager.invalidate).toHaveBeenCalledWith("user-1");
  });

  it("deduplicates principal IDs across events", () => {
    const manager = createMockManager();
    const onInvalidate = mock(() => {});
    const handler: InvalidationHandler = { onInvalidate };

    const processor = createInvalidationProcessor({
      snapshotManager: manager,
      handler,
      debounceMs: 10000,
    });

    processor.process({
      type: "role_assigned",
      tenantId: "t1",
      affectedPrincipalIds: ["user-1", "user-1", "user-2"],
      timestamp: Date.now(),
    });

    processor.flush();

    const call = (onInvalidate as ReturnType<typeof mock>).mock.calls[0];
    const ids = call[0] as string[];
    expect(ids.length).toBe(2);
  });
});
