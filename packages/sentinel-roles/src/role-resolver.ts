import { expandBundles } from './permission-bundle';
import { RoleRegistry } from './role-registry';
import type { PermissionGrant, ResolvedRole } from './types';

/** Deduplicate grants by action+resourceType */
function deduplicateGrants(grants: readonly PermissionGrant[]): readonly PermissionGrant[] {
  const seen = new Set<string>();
  const result: PermissionGrant[] = [];
  for (const g of grants) {
    const key = `${g.action}:${g.resourceType}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(g);
    }
  }
  return result;
}

/** Resolve a single role to its effective grants */
export async function resolveRole(
  roleId: string,
  registry: RoleRegistry,
  tenantId: string,
  visited: Set<string> = new Set(),
): Promise<ResolvedRole> {
  if (visited.has(roleId)) {
    throw new Error(`Circular inheritance detected: ${roleId}`);
  }
  visited.add(roleId);

  const role = await registry.getRole(roleId, tenantId);
  if (!role) {
    return { roleId, effectiveGrants: [], inheritanceChain: [roleId], bundleIds: [] };
  }

  let grants: PermissionGrant[];
  let bundleIds: string[] = [];
  const chain: string[] = [roleId];

  if (role.kind === 'custom') {
    const expanded = expandBundles(role.bundles, registry.getBundles());
    grants = [...expanded, ...role.additionalGrants];
    bundleIds = [...role.bundles];
  } else {
    grants = [...role.grants];
  }

  const inherits = role.inherits ?? [];
  for (const parentId of inherits) {
    const parent = await resolveRole(parentId, registry, tenantId, visited);
    grants = [...grants, ...parent.effectiveGrants];
    chain.push(...parent.inheritanceChain);
    bundleIds = [...bundleIds, ...parent.bundleIds];
  }

  return {
    roleId,
    effectiveGrants: deduplicateGrants(grants),
    inheritanceChain: chain,
    bundleIds,
  };
}

/** Resolve all effective grants for a set of role IDs */
export async function resolveRoles(
  roleIds: readonly string[],
  registry: RoleRegistry,
  tenantId: string,
): Promise<ResolvedRole[]> {
  return Promise.all(roleIds.map((id) => resolveRole(id, registry, tenantId)));
}
