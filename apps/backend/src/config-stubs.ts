// Re-export barrel — maps previous stub exports to real @weaver/* packages.
// Consumers import from this file unchanged; real implementations are now used.

// --- @ghost-shell/config-plugin-runtime ---
export { armadaWeaver } from "@ghost-shell/config-plugin-runtime";
// --- @weaver/config-engine ---
export { inspectKey, resolveConfiguration } from "@weaver/config-engine";
// --- @weaver/config-policy ---
export type {
  OverrideTracker,
  PolicyDecision,
  PolicyEvaluationContext,
} from "@weaver/config-policy";
export {
  createInMemoryOverrideTracker,
  evaluateChangePolicy,
} from "@weaver/config-policy";
// --- @weaver/config-providers ---
export { createConfigurationService } from "@weaver/config-providers";
// --- @weaver/config-server ---
export type {
  ConfigAuditLog,
  FileSystemProviderOptions as FileSystemStorageProviderOptions,
} from "@weaver/config-server";
export {
  createInMemoryAuditLog,
  createServiceConfigurationService,
  FileSystemStorageProvider,
} from "@weaver/config-server";

// --- @weaver/config-sessions ---
export type { OverrideSessionController } from "@weaver/config-sessions";
export { createOverrideSessionProvider } from "@weaver/config-sessions";
// --- @weaver/config-types ---
export type {
  ConfigAuditEntry,
  ConfigurationLayerEntry,
  ConfigurationPropertySchema,
  ConfigurationRole,
  ConfigurationService,
  ServiceConfigurationService,
} from "@weaver/config-types";
export { sessionActivationRequestSchema } from "@weaver/config-types";

// ---------------------------------------------------------------------------
// Local types — not present in @weaver/* packages
// ---------------------------------------------------------------------------

export interface OverrideRecord {
  id: string;
  key: string;
  actor: string;
  reason: string;
  tenantId: string;
  layer: string;
  createdAt: string;
  regularizedAt?: string;
  regularizedBy?: string;
}

export interface StorageLoadResult {
  entries: Record<string, unknown>;
}

export interface StorageWriteResult {
  success: boolean;
  revision?: number;
  error?: string;
}
