import type { PermissionBundle, PermissionGrant } from './types';

/** Define a permission bundle (frozen) */
export function defineBundle(config: PermissionBundle): PermissionBundle {
  return Object.freeze(config);
}

/** Expand bundles into flat permission grants (deduplicates by action+resourceType) */
export function expandBundles(
  bundleIds: readonly string[],
  allBundles: readonly PermissionBundle[],
): readonly PermissionGrant[] {
  const seen = new Set<string>();
  const result: PermissionGrant[] = [];

  for (const id of bundleIds) {
    const bundle = allBundles.find((b) => b.id === id);
    if (!bundle) continue;
    for (const grant of bundle.grants) {
      const key = `${grant.action}:${grant.resourceType}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(grant);
      }
    }
  }

  return result;
}

/** Check if a set of grants covers a specific permission */
export function grantsContain(
  grants: readonly PermissionGrant[],
  action: string,
  resourceType: string,
): boolean {
  return grants.some((g) => g.action === action && g.resourceType === resourceType);
}

export const STANDARD_BUNDLES: readonly PermissionBundle[] = [
  defineBundle({
    id: 'order-viewer',
    name: 'Order Viewer',
    description: 'View and export orders',
    grants: [
      { action: 'view', resourceType: 'order' },
      { action: 'export', resourceType: 'order' },
    ],
  }),
  defineBundle({
    id: 'order-editor',
    name: 'Order Editor',
    description: 'Create and edit orders',
    grants: [
      { action: 'view', resourceType: 'order' },
      { action: 'create', resourceType: 'order' },
      { action: 'edit', resourceType: 'order' },
      { action: 'export', resourceType: 'order' },
    ],
  }),
  defineBundle({
    id: 'shipment-viewer',
    name: 'Shipment Viewer',
    description: 'View shipments',
    grants: [{ action: 'view', resourceType: 'shipment' }],
  }),
  defineBundle({
    id: 'shipment-manager',
    name: 'Shipment Manager',
    description: 'Full shipment management',
    grants: [
      { action: 'view', resourceType: 'shipment' },
      { action: 'create', resourceType: 'shipment' },
      { action: 'edit', resourceType: 'shipment' },
      { action: 'delete', resourceType: 'shipment' },
    ],
  }),
  defineBundle({
    id: 'user-admin',
    name: 'User Administrator',
    description: 'Manage users and role assignments',
    grants: [
      { action: 'view', resourceType: 'user' },
      { action: 'create', resourceType: 'user' },
      { action: 'edit', resourceType: 'user' },
      { action: 'assign-role', resourceType: 'user' },
    ],
  }),
];
