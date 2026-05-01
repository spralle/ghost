import { buildSnapshot } from "@ghost/sentinel";
import type { SentinelPrincipal, PermissionSnapshot, SentinelStore } from "@ghost/sentinel";
import type { BatchBuildOptions, BatchBuildResult } from "./types.js";

/** Run async tasks with bounded concurrency using a worker pool */
async function runPool<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const item = items[index++];
        await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Build snapshots for multiple principals with shared policy caching
 * and bounded concurrency.
 */
export async function buildBatch(
  principals: readonly SentinelPrincipal[],
  options: BatchBuildOptions,
): Promise<BatchBuildResult> {
  const { store, resourceTypes, concurrency = 5 } = options;

  // Pre-fetch policies for all resource types (shared across principals)
  const policyCache = new Map<string, Awaited<ReturnType<SentinelStore["loadPolicies"]>>>();
  for (const rt of resourceTypes) {
    policyCache.set(rt, await store.loadPolicies(rt));
  }

  // Create a cached store wrapper that returns pre-fetched policies
  const cachedStore: SentinelStore = {
    loadTuples: store.loadTuples.bind(store),
    loadTuplesFrom: store.loadTuplesFrom.bind(store),
    loadRoles: store.loadRoles.bind(store),
    loadPolicies: async (resourceType: string) => {
      return policyCache.get(resourceType) ?? store.loadPolicies(resourceType);
    },
  };

  const snapshots = new Map<string, PermissionSnapshot>();
  const errors = new Map<string, Error>();

  await runPool(principals, concurrency, async (principal) => {
    try {
      const snapshot = await buildSnapshot(cachedStore, principal, resourceTypes);
      snapshots.set(principal.userId, snapshot);
    } catch (err: unknown) {
      errors.set(
        principal.userId,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  });

  return { snapshots, errors };
}
