/** A permission grant: allows an action on a resource type */
export interface PermissionGrant {
  readonly action: string;
  readonly resourceType: string;
  readonly condition?: unknown;
}

/** A bundle groups related permissions under a name */
export interface PermissionBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly grants: readonly PermissionGrant[];
}

/** System role — hardcoded, cannot be modified by tenant-admins */
export interface SystemRole {
  readonly kind: 'system';
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly grants: readonly PermissionGrant[];
  readonly inherits?: readonly string[];
}

/** Custom role — created by tenant-admins */
export interface CustomRole {
  readonly kind: 'custom';
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly bundles: readonly string[];
  readonly additionalGrants: readonly PermissionGrant[];
  readonly inherits: readonly string[];
  readonly createdBy: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Union of both role types */
export type RoleDefinition = SystemRole | CustomRole;

/** Options for creating a custom role */
export interface CreateRoleInput {
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly bundles: readonly string[];
  readonly additionalGrants?: readonly PermissionGrant[];
  readonly inherits?: readonly string[];
  readonly createdBy: string;
}

/** Options for updating a custom role */
export interface UpdateRoleInput {
  readonly name?: string;
  readonly description?: string;
  readonly bundles?: readonly string[];
  readonly additionalGrants?: readonly PermissionGrant[];
  readonly inherits?: readonly string[];
}

/** The resolved effective permissions for a role */
export interface ResolvedRole {
  readonly roleId: string;
  readonly effectiveGrants: readonly PermissionGrant[];
  readonly inheritanceChain: readonly string[];
  readonly bundleIds: readonly string[];
}

/** Storage interface for role persistence */
export interface RoleStore {
  loadSystemRoles(): Promise<readonly SystemRole[]>;
  loadCustomRoles(tenantId: string): Promise<readonly CustomRole[]>;
  saveCustomRole(role: CustomRole): Promise<void>;
  deleteCustomRole(tenantId: string, roleId: string): Promise<void>;
  loadBundles(): Promise<readonly PermissionBundle[]>;
}
