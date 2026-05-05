import { buildSnapshot, isExpired } from "@sentinel-guard/core";
import type { SentinelPrincipal, PermissionSnapshot } from "@sentinel-guard/core";
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
  // Reverse lookup: principalId → tenantId for cleanup on single invalidate
  const principalTenant = new Map<string, string>();

  function indexByTenant(snapshot: PermissionSnapshot): void {
    let set = tenantIndex.get(snapshot.tenantId);
    if (!set) {
      set = new Set();
      tenantIndex.set(snapshot.tenantId, set);
    }
    set.add(snapshot.principalId);
    principalTenant.set(snapshot.principalId, snapshot.tenantId);
  }

  function removeFromTenantIndex(principalId: string): void {
    const tenantId = principalTenant.get(principalId);
    if (!tenantId) return;
    const set = tenantIndex.get(tenantId);
    if (set) set.delete(principalId);
    principalTenant.delete(principalId);
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
        removeFromTenantIndex(principalId);
        return undefined;
      }
      return snapshot;
    },

    invalidate(principalId: string): void {
      cache.delete(principalId);
      removeFromTenantIndex(principalId);
    },

    invalidateByTenant(tenantId: string): void {
      const ids = tenantIndex.get(tenantId);
      if (!ids) return;
      for (const id of ids) {
        cache.delete(id);
        principalTenant.delete(id);
      }
      ids.clear();
    },

    serialize(snapshot: PermissionSnapshot): string {
      if (customSerialize) return customSerialize(snapshot);
      // GraphSubset exposes .tuples as a readonly array — use it for serialization
      // Assumption: GraphSubset can be reconstructed from its tuples array
      return JSON.stringify({
        ...snapshot,
        graphCone: { tuples: snapshot.graphCone.tuples },
      });
    },
  };
}
