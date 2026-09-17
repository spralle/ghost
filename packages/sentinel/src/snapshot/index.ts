export type { PermissionSnapshot } from "./permission-snapshot.js";
export { buildSnapshot, type SnapshotBuilderOptions } from "./snapshot-builder.js";
export { DEFAULT_ROLE_TTLS, getTtlForRoles, isExpired, needsRefresh } from "./snapshot-validator.js";
