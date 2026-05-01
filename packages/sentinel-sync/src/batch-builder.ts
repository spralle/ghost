import { buildSnapshot } from "@ghost/sentinel";
import type { SentinelPrincipal, PermissionSnapshot, SentinelStore } from "@ghost/sentinel";
import type { BatchBuildOptions, BatchBuildResult } from "./types.js";

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

  // Process with bounded concurrency
  const queue = [...principals];
  const active: Promise<void>[] = [];

  async function processOne(principal: SentinelPrincipal): Promise<void> {
    try {
      const snapshot = await buildSnapshot(cachedStore, principal, resourceTypes);
      snapshots.set(principal.userId, snapshot);
    } catch (err: unknown) {
      errors.set(
        principal.userId,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  for (const principal of queue) {
    const promise = processOne(principal);
    active.push(promise);

    if (active.length >= concurrency) {
      await Promise.race(active);
      // Remove settled promises
      for (let i = active.length - 1; i >= 0; i--) {
        const settled = await Promise.race([
          active[i].then(() => true),
          Promise.resolve(false),
        ]);
        if (settled) active.splice(i, 1);
      }
    }
  }

  await Promise.all(active);

  return { snapshots, errors };
}
