// Inline stubs replacing deleted @weaver/* and @ghost-shell/config-plugin-runtime packages.
// All types are structural duplicates; all runtime exports are no-ops.

export type ConfigurationRole =
  | "platform-ops"
  | "tenant-admin"
  | "scope-admin"
  | "integrator"
  | "user"
  | "support"
  | "system"
  | "service"
  | "platform-service";

export interface PolicyEvaluationContext {
  userId: string;
  tenantId: string;
  roles: ConfigurationRole[];
  sessionMode?: string;
  overrideReason?: string;
}

export type PolicyDecision =
  | { outcome: "allowed" }
  | { outcome: "requires-promotion"; message?: string }
  | { outcome: "requires-emergency-auth"; message?: string }
  | { outcome: "denied"; reason?: string };

export interface ConfigurationPropertySchema {
  type?: string;
  default?: unknown;
  description?: string;
  reloadBehavior?: string;
  changePolicy?: string;
}

export interface ConfigAuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  key: string;
  layer: string;
  tenantId: string;
  newValue?: unknown;
  changePolicy?: string;
  isEmergencyOverride?: boolean;
  overrideReason?: string;
}

export interface ConfigAuditLog {
  append(entry: ConfigAuditEntry): Promise<void>;
  queryByKey(key: string): Promise<ConfigAuditEntry[]>;
  queryByTimeRange(from: string, to: string): Promise<ConfigAuditEntry[]>;
  getRecent(limit?: number): Promise<ConfigAuditEntry[]>;
}

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

export interface OverrideTracker {
  create(record: OverrideRecord): Promise<void>;
  listActive(): Promise<OverrideRecord[]>;
  listOverdue(): Promise<OverrideRecord[]>;
  regularize(id: string, by: string): Promise<OverrideRecord | undefined>;
}

export interface OverrideSessionController {
  activate(data: unknown): unknown;
  deactivate(): unknown;
  getSession(): unknown;
  isActive(): boolean;
}

export interface ConfigurationService {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  onChange(cb: () => void): () => void;
}

export interface ServiceConfigurationService {
  get(key: string): unknown;
}

export interface ConfigurationLayerEntry {
  layer: string;
  entries: Record<string, unknown>;
}

export interface StorageLoadResult {
  entries: Record<string, unknown>;
}

export interface StorageWriteResult {
  success: boolean;
  revision?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Runtime stubs — no-op placeholders for removed @weaver/* packages.
// Each stub warns once on first invocation so developers know it's non-functional.
// ---------------------------------------------------------------------------

const _warned = new Set<string>();
function warnOnce(name: string): void {
  if (!_warned.has(name)) {
    _warned.add(name);
    console.warn(`[config-stubs] ${name} is a no-op placeholder (removed @weaver/* packages)`);
  }
}

export interface FileSystemStorageProviderOptions {
  id: string;
  layer: string;
  filePath: string;
  writable?: boolean;
  environmentOverlayPath?: string;
}

/** @deprecated No-op stub — @weaver/config-providers removed. Always returns empty data. */
export class FileSystemStorageProvider {
  constructor(_options?: FileSystemStorageProviderOptions) {}

  async load(): Promise<StorageLoadResult> {
    warnOnce("FileSystemStorageProvider.load");
    return { entries: {} };
  }

  async write(_key: string, _value: unknown): Promise<StorageWriteResult> {
    return { success: true, revision: 0 };
  }

  async remove(_key: string): Promise<StorageWriteResult> {
    return { success: true, revision: 0 };
  }
}

/** @deprecated No-op stub — @weaver/config-engine removed. Always returns "allowed". */
export function evaluateChangePolicy(
  _schema: ConfigurationPropertySchema,
  _context: PolicyEvaluationContext,
  _layer: string,
  _canWrite: () => boolean,
): PolicyDecision {
  warnOnce("evaluateChangePolicy");
  return { outcome: "allowed" };
}

/** @deprecated No-op stub — @weaver/config-engine removed. Merges layers left-to-right. */
export function resolveConfiguration(opts: { layers: ConfigurationLayerEntry[] }): {
  entries: Record<string, unknown>;
} {
  warnOnce("resolveConfiguration");
  const entries: Record<string, unknown> = {};
  for (const layer of opts.layers) {
    Object.assign(entries, layer.entries);
  }
  return { entries };
}

/** @deprecated No-op stub — @weaver/config-engine removed. */
export function inspectKey(opts: { layers: ConfigurationLayerEntry[] }, key: string): { effectiveValue: unknown } {
  warnOnce("inspectKey");
  let effectiveValue: unknown;
  for (const layer of opts.layers) {
    if (key in layer.entries) {
      effectiveValue = layer.entries[key];
    }
  }
  return { effectiveValue };
}

/** @deprecated No-op stub — returns an in-memory audit log that discards all entries. */
export function createInMemoryAuditLog(): ConfigAuditLog {
  warnOnce("createInMemoryAuditLog");
  return {
    async append() {},
    async queryByKey() {
      return [];
    },
    async queryByTimeRange() {
      return [];
    },
    async getRecent() {
      return [];
    },
  };
}

/** @deprecated No-op stub — returns an override tracker that tracks nothing. */
export function createInMemoryOverrideTracker(): OverrideTracker {
  warnOnce("createInMemoryOverrideTracker");
  return {
    async create() {},
    async listActive() {
      return [];
    },
    async listOverdue() {
      return [];
    },
    async regularize() {
      return undefined;
    },
  };
}

/** @deprecated No-op stub — returns a session controller that is never active. */
export function createOverrideSessionProvider(): OverrideSessionController {
  warnOnce("createOverrideSessionProvider");
  return {
    isActive() {
      return false;
    },
    activate(_data: unknown) {
      return { active: true };
    },
    deactivate() {
      return { active: false };
    },
    getSession() {
      return null;
    },
  };
}

/** @deprecated No-op stub — returns a config service that stores nothing. */
export async function createConfigurationService(_opts: unknown): Promise<ConfigurationService> {
  warnOnce("createConfigurationService");
  return {
    get() {
      return undefined;
    },
    set() {},
    onChange() {
      return () => {};
    },
  };
}

/** @deprecated No-op stub — returns a service config that always returns undefined. */
export function createServiceConfigurationService(_opts: unknown): ServiceConfigurationService {
  warnOnce("createServiceConfigurationService");
  return {
    get() {
      return undefined;
    },
  };
}

export const sessionActivationRequestSchema = {
  safeParse(data: unknown): { success: true; data: unknown } | { success: false; error: { issues: unknown[] } } {
    return { success: true, data };
  },
};

export const ghostWeaver = undefined;
