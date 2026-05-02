import type {
  CreateRoleInput,
  CustomRole,
  PermissionBundle,
  RoleDefinition,
  RoleStore,
  SystemRole,
  UpdateRoleInput,
} from './types';

export interface RoleRegistryConfig {
  readonly store: RoleStore;
  readonly systemRoles: readonly SystemRole[];
  readonly bundles: readonly PermissionBundle[];
}

function generateId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug}-${suffix}`;
}

export class RoleRegistry {
  private readonly store: RoleStore;
  private readonly systemRoles: readonly SystemRole[];
  private readonly bundles: readonly PermissionBundle[];

  constructor(config: RoleRegistryConfig) {
    this.store = config.store;
    this.systemRoles = config.systemRoles;
    this.bundles = config.bundles;
  }

  getSystemRoles(): readonly SystemRole[] {
    return this.systemRoles;
  }

  async getCustomRoles(tenantId: string): Promise<readonly CustomRole[]> {
    return this.store.loadCustomRoles(tenantId);
  }

  async getRole(roleId: string, tenantId?: string): Promise<RoleDefinition | undefined> {
    const sys = this.systemRoles.find((r) => r.id === roleId);
    if (sys) return sys;
    if (tenantId) {
      const customs = await this.store.loadCustomRoles(tenantId);
      return customs.find((r) => r.id === roleId);
    }
    return undefined;
  }

  async createRole(input: CreateRoleInput): Promise<CustomRole> {
    const errors = this.validate(input);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const now = Date.now();
    const role: CustomRole = {
      kind: 'custom',
      id: generateId(input.name),
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      bundles: input.bundles,
      additionalGrants: input.additionalGrants ?? [],
      inherits: input.inherits ?? [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveCustomRole(role);
    return role;
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: UpdateRoleInput,
  ): Promise<CustomRole> {
    const customs = await this.store.loadCustomRoles(tenantId);
    const existing = customs.find((r) => r.id === roleId);
    if (!existing) {
      throw new Error(`Role ${roleId} not found in tenant ${tenantId}`);
    }

    const updated: CustomRole = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      bundles: input.bundles ?? existing.bundles,
      additionalGrants: input.additionalGrants ?? existing.additionalGrants,
      inherits: input.inherits ?? existing.inherits,
      updatedAt: Date.now(),
    };

    await this.store.saveCustomRole(updated);
    return updated;
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    await this.store.deleteCustomRole(tenantId, roleId);
  }

  getBundles(): readonly PermissionBundle[] {
    return this.bundles;
  }

  validate(input: CreateRoleInput): readonly string[] {
    const errors: string[] = [];

    if (input.inherits) {
      for (const id of input.inherits) {
        if (!this.systemRoles.find((r) => r.id === id)) {
          errors.push(`Invalid inherits: system role '${id}' not found`);
        }
      }
    }

    if (input.bundles) {
      for (const id of input.bundles) {
        if (!this.bundles.find((b) => b.id === id)) {
          errors.push(`Invalid bundle: '${id}' not found`);
        }
      }
    }

    return errors;
  }
}
