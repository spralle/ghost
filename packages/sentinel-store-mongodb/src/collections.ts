export const COLLECTION_NAMES = {
  tuples: 'tuples',
  policies: 'policies',
  roles: 'roles',
} as const;

export const INDEXES = {
  tuples: [
    { key: { nodeType: 1, nodeId: 1, relation: 1 }, name: 'tuples_node_relation' },
    { key: { nodeType: 1, nodeId: 1 }, name: 'tuples_node' },
  ],
  policies: [
    { key: { resourceType: 1 }, name: 'policies_resource_type' },
  ],
  roles: [
    { key: { principalId: 1 }, unique: true, name: 'roles_principal' },
  ],
} as const;
