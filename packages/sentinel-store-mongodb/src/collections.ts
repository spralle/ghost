export const COLLECTION_NAMES = {
  tuples: 'tuples',
  policies: 'policies',
  roles: 'roles',
} as const;

export const INDEXES = {
  tuples: [
    { key: { tenantId: 1, nodeType: 1, nodeId: 1, relation: 1 }, name: 'tuples_tenant_node_relation' },
    { key: { tenantId: 1, nodeType: 1, nodeId: 1 }, name: 'tuples_tenant_node' },
  ],
  policies: [
    { key: { tenantId: 1, resourceType: 1 }, name: 'policies_tenant_resource_type' },
  ],
  roles: [
    { key: { tenantId: 1, principalId: 1 }, unique: true, name: 'roles_tenant_principal' },
  ],
} as const;
