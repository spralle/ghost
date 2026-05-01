import { describe, expect, test } from 'bun:test';
import { RoleRegistry } from '../src/role-registry';
import { MemoryRoleStore } from '../src/role-store';
import { STANDARD_BUNDLES } from '../src/permission-bundle';
import { resolveRole, resolveRoles } from '../src/role-resolver';
import type { SystemRole } from '../src/types';

const SYSTEM_ROLES: readonly SystemRole[] = [
  {
    kind: 'system',
    id: 'user',
    name: 'User',
    description: 'Basic user',
    grants: [{ action: 'view', resourceType: 'dashboard' }],
  },
  {
    kind: 'system',
    id: 'scope-admin',
    name: 'Scope Admin',
    description: 'Scope administrator',
    grants: [{ action: 'manage', resourceType: 'scope' }],
    inherits: ['user'],
  },
];

function createRegistry() {
  const store = new MemoryRoleStore(SYSTEM_ROLES, STANDARD_BUNDLES);
  return new RoleRegistry({ store, systemRoles: SYSTEM_ROLES, bundles: STANDARD_BUNDLES });
}

describe('resolveRole', () => {
  test('resolves system role with direct grants', async () => {
    const registry = createRegistry();
    const resolved = await resolveRole('user', registry, 'tenant-1');
    expect(resolved.effectiveGrants).toHaveLength(1);
    expect(resolved.effectiveGrants[0].action).toBe('view');
  });

  test('resolves custom role expanding bundles + additionalGrants', async () => {
    const registry = createRegistry();
    const role = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Custom',
      description: 'test',
      bundles: ['order-viewer'],
      additionalGrants: [{ action: 'view', resourceType: 'report' }],
      createdBy: 'user-1',
    });
    const resolved = await resolveRole(role.id, registry, 'tenant-1');
    expect(resolved.effectiveGrants.length).toBeGreaterThanOrEqual(3);
  });

  test('resolves with inheritance merging parent grants', async () => {
    const registry = createRegistry();
    const resolved = await resolveRole('scope-admin', registry, 'tenant-1');
    // scope-admin grants + user grants
    expect(resolved.effectiveGrants).toHaveLength(2);
    expect(resolved.inheritanceChain).toEqual(['scope-admin', 'user']);
  });

  test('resolves custom role with multi-level inheritance', async () => {
    const registry = createRegistry();
    const role = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Deep',
      description: 'test',
      bundles: ['shipment-viewer'],
      inherits: ['scope-admin'],
      createdBy: 'user-1',
    });
    const resolved = await resolveRole(role.id, registry, 'tenant-1');
    // shipment:view + scope:manage + dashboard:view
    expect(resolved.effectiveGrants).toHaveLength(3);
    expect(resolved.inheritanceChain).toContain('user');
  });

  test('circular inheritance throws error', async () => {
    const registry = createRegistry();
    const visited = new Set<string>();
    visited.add('user');
    await expect(resolveRole('user', registry, 'tenant-1', visited)).rejects.toThrow(
      'Circular inheritance',
    );
  });

  test('unknown role returns empty grants', async () => {
    const registry = createRegistry();
    const resolved = await resolveRole('nonexistent', registry, 'tenant-1');
    expect(resolved.effectiveGrants).toHaveLength(0);
  });

  test('deduplicates same grant from bundle + additionalGrants', async () => {
    const registry = createRegistry();
    const role = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Dupe',
      description: 'test',
      bundles: ['order-viewer'],
      additionalGrants: [{ action: 'view', resourceType: 'order' }],
      createdBy: 'user-1',
    });
    const resolved = await resolveRole(role.id, registry, 'tenant-1');
    const viewOrders = resolved.effectiveGrants.filter(
      (g) => g.action === 'view' && g.resourceType === 'order',
    );
    expect(viewOrders).toHaveLength(1);
  });

  test('resolveRoles resolves multiple roles', async () => {
    const registry = createRegistry();
    const results = await resolveRoles(['user', 'scope-admin'], registry, 'tenant-1');
    expect(results).toHaveLength(2);
  });
});
