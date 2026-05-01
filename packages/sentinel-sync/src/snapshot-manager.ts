import { buildSnapshot, isExpired } from "@ghost/sentinel";
import type { SentinelPrincipal, PermissionSnapshot } from "@ghost/sentinel";
import type { SnapshotCache, SnapshotManager, SnapshotManagerConfig } from "./types.js";

/** Default in-memory cache */
function createDefaultCache(): SnapshotCache {
  const map = new Map<string, PermissionSnapshot>();
  return {
    get: (id) => map.get(id),
    set: (id, snapshot) => { map.set(id, snapshot); },
    delete: (id) => { map.delete(id); },
    clear: () => { map.clear(); },
  };
}

/** Create a SnapshotManager that wraps buildSnapshot with caching */
export function createSnapshotManager(config: SnapshotManagerConfig): SnapshotManager {
  const { store, resourceTypes, serialize: customSerialize } = config;
  const cache = config.cache ?? createDefaultCache();

  // Track tenantId → principalIds for tenant-level invalidation
  const tenantIndex = new Map<string, Set<string>>();

  function indexByTenant(snapshot: PermissionSnapshot): void {
    let set = tenantIndex.get(snapshot.tenantId);
    if (!set) {
      set = new Set();
      tenantIndex.set(snapshot.tenantId, set);
    }
    set.add(snapshot.principalId);
  }

  return {
    async build(principal: SentinelPrincipal): Promise<PermissionSnapshot> {
      const snapshot = await buildSnapshot(store, principal, resourceTypes);
      cache.set(principal.userId, snapshot);
      indexByTenant(snapshot);
      return snapshot;
    },

    get(principalId: string): PermissionSnapshot | undefined {
      const snapshot = cache.get(principalId);
      if (!snapshot) return undefined;
      if (isExpired(snapshot)) {
        cache.delete(principalId);
        return undefined;
      }
      return snapshot;
    },

    invalidate(principalId: string): void {
      cache.delete(principalId);
    },

    invalidateByTenant(tenantId: string): void {
      const ids = tenantIndex.get(tenantId);
      if (!ids) return;
      for (const id of ids) {
        cache.delete(id);
      }
      ids.clear();
    },

    serialize(snapshot: PermissionSnapshot): string {
      if (customSerialize) return customSerialize(snapshot);
      return JSON.stringify({
        ...snapshot,
        graphCone: { tuples: snapshot.graphCone.tuples },
      });
    },
  };
}
