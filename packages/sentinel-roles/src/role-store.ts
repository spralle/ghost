import type { CustomRole, PermissionBundle, RoleStore, SystemRole } from './types';

/** In-memory implementation of RoleStore for testing */
export class MemoryRoleStore implements RoleStore {
  private readonly systemRoles: SystemRole[];
  private readonly customRoles: CustomRole[] = [];
  private readonly bundles: PermissionBundle[];

  constructor(systemRoles: readonly SystemRole[] = [], bundles: readonly PermissionBundle[] = []) {
    this.systemRoles = [...systemRoles];
    this.bundles = [...bundles];
  }

  async loadSystemRoles(): Promise<readonly SystemRole[]> {
    return this.systemRoles;
  }

  async loadCustomRoles(tenantId: string): Promise<readonly CustomRole[]> {
    return this.customRoles.filter((r) => r.tenantId === tenantId);
  }

  async saveCustomRole(role: CustomRole): Promise<void> {
    const idx = this.customRoles.findIndex(
      (r) => r.id === role.id && r.tenantId === role.tenantId,
    );
    if (idx >= 0) {
      this.customRoles[idx] = role;
    } else {
      this.customRoles.push(role);
    }
  }

  async deleteCustomRole(tenantId: string, roleId: string): Promise<void> {
    const idx = this.customRoles.findIndex(
      (r) => r.id === roleId && r.tenantId === tenantId,
    );
    if (idx >= 0) {
      this.customRoles.splice(idx, 1);
    }
  }

  async loadBundles(): Promise<readonly PermissionBundle[]> {
    return this.bundles;
  }
}
