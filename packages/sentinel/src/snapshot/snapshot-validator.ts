import type { PermissionSnapshot } from "./permission-snapshot";

/** Default TTLs per role */
export const DEFAULT_ROLE_TTLS: Readonly<Record<string, number>> = {
  "platform-ops": 60 * 60 * 1000, // 1h
  "tenant-admin": 2 * 60 * 60 * 1000, // 2h
  "user": 8 * 60 * 60 * 1000, // 8h
  "service": 24 * 60 * 60 * 1000, // 24h
} as const;

/** Role priority order (lower index = higher priority = shorter TTL) */
const ROLE_PRIORITY: readonly string[] = ["platform-ops", "tenant-admin", "user", "service"];

/** Check if a snapshot has expired */
export function isExpired(snapshot: PermissionSnapshot): boolean {
  return Date.now() >= snapshot.timestamp + snapshot.ttl;
}

/** Check if a snapshot needs refresh (within 20% of TTL remaining) */
export function needsRefresh(snapshot: PermissionSnapshot): boolean {
  const expiresAt = snapshot.timestamp + snapshot.ttl;
  const refreshThreshold = snapshot.ttl * 0.2;
  return Date.now() >= expiresAt - refreshThreshold;
}

/** Get TTL for a principal based on their highest-priority role */
export function getTtlForRoles(
  roles: readonly string[],
  customTtls?: Readonly<Record<string, number>>,
): number {
  const ttls = customTtls ?? DEFAULT_ROLE_TTLS;

  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role) && role in ttls) {
      return ttls[role]!;
    }
  }

  // Check custom roles not in priority list
  for (const role of roles) {
    if (role in ttls) {
      return ttls[role]!;
    }
  }

  // Default to "user" TTL
  return ttls["user"] ?? 8 * 60 * 60 * 1000;
}
