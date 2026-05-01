import { describe, expect, test } from 'bun:test';
import { RoleRegistry } from '../src/role-registry';
import { MemoryRoleStore } from '../src/role-store';
import { STANDARD_BUNDLES } from '../src/permission-bundle';
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
    id: 'tenant-admin',
    name: 'Tenant Admin',
    description: 'Tenant administrator',
    grants: [
      { action: 'view', resourceType: 'dashboard' },
      { action: 'manage', resourceType: 'tenant' },
    ],
    inherits: ['user'],
  },
];

function createRegistry() {
  const store = new MemoryRoleStore(SYSTEM_ROLES, STANDARD_BUNDLES);
  return new RoleRegistry({ store, systemRoles: SYSTEM_ROLES, bundles: STANDARD_BUNDLES });
}

describe('RoleRegistry', () => {
  test('getSystemRoles returns all system roles', () => {
    const registry = createRegistry();
    expect(registry.getSystemRoles()).toHaveLength(2);
  });

  test('createRole generates valid custom role with ID', async () => {
    const registry = createRegistry();
    const role = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Order Viewer',
      description: 'Can view orders',
      bundles: ['order-viewer'],
      createdBy: 'user-1',
    });
    expect(role.kind).toBe('custom');
    expect(role.id).toContain('order-viewer');
    expect(role.tenantId).toBe('tenant-1');
  });

  test('createRole fails validation for invalid inherits', async () => {
    const registry = createRegistry();
    await expect(
      registry.createRole({
        tenantId: 'tenant-1',
        name: 'Bad Role',
        description: 'test',
        bundles: [],
        inherits: ['nonexistent-role'],
        createdBy: 'user-1',
      }),
    ).rejects.toThrow('Validation failed');
  });

  test('createRole fails validation for invalid bundle IDs', async () => {
    const registry = createRegistry();
    await expect(
      registry.createRole({
        tenantId: 'tenant-1',
        name: 'Bad Role',
        description: 'test',
        bundles: ['fake-bundle'],
        createdBy: 'user-1',
      }),
    ).rejects.toThrow('Validation failed');
  });

  test('getCustomRoles returns only for specified tenant', async () => {
    const registry = createRegistry();
    await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Role A',
      description: 'A',
      bundles: ['order-viewer'],
      createdBy: 'user-1',
    });
    await registry.createRole({
      tenantId: 'tenant-2',
      name: 'Role B',
      description: 'B',
      bundles: ['order-viewer'],
      createdBy: 'user-2',
    });
    const t1Roles = await registry.getCustomRoles('tenant-1');
    expect(t1Roles).toHaveLength(1);
    expect(t1Roles[0].tenantId).toBe('tenant-1');
  });

  test('updateRole modifies existing role', async () => {
    const registry = createRegistry();
    const role = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Original',
      description: 'orig',
      bundles: ['order-viewer'],
      createdBy: 'user-1',
    });
    const updated = await registry.updateRole('tenant-1', role.id, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
  });

  test('deleteRole removes role', async () => {
    const registry = createRegistry();
    const role = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'ToDelete',
      description: 'del',
      bundles: ['order-viewer'],
      createdBy: 'user-1',
    });
    await registry.deleteRole('tenant-1', role.id);
    const roles = await registry.getCustomRoles('tenant-1');
    expect(roles).toHaveLength(0);
  });

  test('getRole returns system role by ID', async () => {
    const registry = createRegistry();
    const role = await registry.getRole('user');
    expect(role?.kind).toBe('system');
  });

  test('getRole returns custom role by tenantId+roleId', async () => {
    const registry = createRegistry();
    const created = await registry.createRole({
      tenantId: 'tenant-1',
      name: 'Custom',
      description: 'c',
      bundles: ['order-viewer'],
      createdBy: 'user-1',
    });
    const found = await registry.getRole(created.id, 'tenant-1');
    expect(found?.id).toBe(created.id);
  });
});
