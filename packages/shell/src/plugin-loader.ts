import {
  type ActivationContext,
  type GhostApi,
  type PluginContract,
  parsePluginContract,
  type TenantPluginDescriptor,
} from "@ghost-shell/contracts";
import { createShellFederationRuntime, type ShellFederationRuntime } from "./federation-runtime.js";

/** The activate() function signature exported by a plugin module. */
export type PluginActivateFunction = (api: GhostApi, context: ActivationContext) => void | Promise<void>;

/** The optional deactivate() function signature exported by a plugin module. */
export type PluginDeactivateExport = (context: { readonly pluginId: string }) => void | Promise<void>;

/** Result of loading and validating a plugin's contract module. */
export interface PluginContractLoadResult {
  contract: PluginContract;
  activate: PluginActivateFunction | null;
  deactivate: PluginDeactivateExport | null;
  exports: Record<string, Function>;
}

/**
 * Strategy for loading plugin modules from a remote or local source.
 * Implementations encapsulate the transport mechanism (federation, local, etc.)
 * while the registry orchestrates lifecycle around the loaded artifacts.
 */
export interface PluginLoadStrategy {
  /** Human-readable identifier for this strategy (used in diagnostics/snapshots). */
  readonly name: string;
  loadPluginContract(descriptor: TenantPluginDescriptor): Promise<PluginContractLoadResult>;
  loadPluginComponents(descriptor: TenantPluginDescriptor): Promise<unknown>;
  loadPluginServices(descriptor: TenantPluginDescriptor): Promise<unknown>;
}

export interface PluginLoadDiagnostic {
  pluginId: string;
  level: "info" | "warn";
  code:
    | "REMOTE_LOAD_RETRY"
    | "REMOTE_LOAD_EXHAUSTED"
    | "INVALID_CONTRACT"
    | "REMOTE_MODULE_LOAD_RETRY"
    | "REMOTE_MODULE_LOAD_EXHAUSTED";
  message: string;
  attempt?: number;
  maxAttempts?: number;
  module?: "pluginContract" | "pluginComponents" | "pluginServices";
  cause?: unknown;
}

export interface PluginLoadErrorContext {
  pluginId: string;
  strategy: string;
  reason: "REMOTE_UNAVAILABLE" | "INVALID_CONTRACT" | "COMPONENTS_UNAVAILABLE" | "SERVICES_UNAVAILABLE";
  message: string;
  attempts: number;
  maxAttempts: number;
  cause?: unknown;
}

export class PluginLoadError extends Error {
  readonly context: PluginLoadErrorContext;

  constructor(context: PluginLoadErrorContext) {
    super(context.message);
    this.name = "PluginLoadError";
    this.context = context;
  }
}

export interface RuntimeFirstPluginLoaderOptions {
  federationRuntime?: ShellFederationRuntime;
  remoteLoadMaxAttempts?: number;
  remoteLoadRetryDelayMs?: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
}

function resolveContractExport(moduleValue: unknown): unknown {
  if (!moduleValue || typeof moduleValue !== "object") {
    return moduleValue;
  }

  const record = moduleValue as Record<string, unknown>;
  if ("pluginContract" in record) {
    return record.pluginContract;
  }

  if ("default" in record) {
    return record.default;
  }

  return moduleValue;
}

export function createRuntimeFirstPluginLoader(options: RuntimeFirstPluginLoaderOptions = {}): PluginLoadStrategy {
  const federationRuntime = options.federationRuntime ?? createShellFederationRuntime();
  const remoteLoadMaxAttempts = clampAttempts(options.remoteLoadMaxAttempts ?? 3);
  const remoteLoadRetryDelayMs = Math.max(0, options.remoteLoadRetryDelayMs ?? 300);
  const onDiagnostic = options.onDiagnostic;

  return {
    name: "remote-manifest",
    async loadPluginContract(descriptor) {
      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      const rawContract = await loadRemoteContractWithRetry({
        descriptor,
        federationRuntime,
        remoteLoadMaxAttempts,
        remoteLoadRetryDelayMs,
        onDiagnostic,
      });
      const { contractData, activate, deactivate, exports: extractedExports } = extractContractAndActivate(rawContract);
      const parsed = parsePluginContract(contractData);

      if (!parsed.success) {
        const details = parsed.errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join("; ");
        const message = `Remote plugin '${descriptor.id}' returned invalid contract: ${details}`;
        emitDiagnostic(onDiagnostic, {
          pluginId: descriptor.id,
          level: "warn",
          code: "INVALID_CONTRACT",
          message,
        });
        throw new PluginLoadError({
          pluginId: descriptor.id,
          strategy: "remote-manifest",
          reason: "INVALID_CONTRACT",
          message,
          attempts: remoteLoadMaxAttempts,
          maxAttempts: remoteLoadMaxAttempts,
        });
      }

      return { contract: parsed.data, activate, deactivate, exports: extractedExports };
    },
    async loadPluginComponents(descriptor) {
      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      try {
        const mod = await loadRemoteModuleWithRetry({
          descriptor,
          federationRuntime,
          remoteLoadMaxAttempts,
          remoteLoadRetryDelayMs,
          onDiagnostic,
          module: "pluginComponents",
        });
        return mod ?? {};
      } catch {
        // Plugin does not expose components — fall back to empty module
        return {};
      }
    },
    async loadPluginServices(descriptor) {
      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      try {
        const mod = await loadRemoteModuleWithRetry({
          descriptor,
          federationRuntime,
          remoteLoadMaxAttempts,
          remoteLoadRetryDelayMs,
          onDiagnostic,
          module: "pluginServices",
        });
        return mod ?? {};
      } catch {
        // Plugin does not expose services — fall back to empty module
        return {};
      }
    },
  };
}

interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  onRetry?: (attempt: number, error: unknown) => void;
  onExhausted?: (attempt: number, error: unknown) => void;
}

async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let latestError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      latestError = error;
      if (attempt < options.maxAttempts) {
        options.onRetry?.(attempt, error);
        await delay(options.delayMs);
        continue;
      }
      options.onExhausted?.(attempt, error);
    }
  }

  throw latestError;
}

interface RemoteRetryLoadOptions {
  descriptor: TenantPluginDescriptor;
  federationRuntime: ShellFederationRuntime;
  remoteLoadMaxAttempts: number;
  remoteLoadRetryDelayMs: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
  module?: "pluginContract" | "pluginComponents" | "pluginServices";
}

async function loadRemoteContractWithRetry(options: RemoteRetryLoadOptions): Promise<unknown> {
  try {
    return await withRetry(() => options.federationRuntime.loadPluginContract(options.descriptor.id), {
      maxAttempts: options.remoteLoadMaxAttempts,
      delayMs: options.remoteLoadRetryDelayMs,
      onRetry(attempt, error) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "info",
          code: "REMOTE_LOAD_RETRY",
          message: `Retrying remote load for plugin '${options.descriptor.id}' (attempt ${attempt + 1}/${options.remoteLoadMaxAttempts}).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: "pluginContract",
          cause: error,
        });
      },
      onExhausted(attempt, error) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "warn",
          code: "REMOTE_LOAD_EXHAUSTED",
          message: `Remote plugin '${options.descriptor.id}' is unavailable after ${options.remoteLoadMaxAttempts} attempt(s).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: "pluginContract",
          cause: error,
        });
      },
    });
  } catch (latestError) {
    throw new PluginLoadError({
      pluginId: options.descriptor.id,
      strategy: "remote-manifest",
      reason: "REMOTE_UNAVAILABLE",
      message: `Remote plugin '${options.descriptor.id}' could not be loaded. Check remote entry and network availability.`,
      attempts: options.remoteLoadMaxAttempts,
      maxAttempts: options.remoteLoadMaxAttempts,
      cause: latestError,
    });
  }
}

async function loadRemoteModuleWithRetry(options: RemoteRetryLoadOptions): Promise<unknown> {
  const moduleName = options.module ?? "pluginContract";

  return withRetry(
    () => {
      if (moduleName === "pluginComponents") {
        return options.federationRuntime.loadPluginComponents(options.descriptor.id);
      }
      if (moduleName === "pluginServices") {
        return options.federationRuntime.loadPluginServices(options.descriptor.id);
      }
      return options.federationRuntime.loadPluginContract(options.descriptor.id);
    },
    {
      maxAttempts: options.remoteLoadMaxAttempts,
      delayMs: options.remoteLoadRetryDelayMs,
      onRetry(attempt, error) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "info",
          code: "REMOTE_MODULE_LOAD_RETRY",
          message:
            `Retrying remote load for plugin '${options.descriptor.id}' module './${moduleName}' ` +
            `(attempt ${attempt + 1}/${options.remoteLoadMaxAttempts}).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: moduleName,
          cause: error,
        });
      },
      onExhausted(attempt, error) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "warn",
          code: "REMOTE_MODULE_LOAD_EXHAUSTED",
          message:
            `Remote plugin '${options.descriptor.id}' module './${moduleName}' is unavailable after ` +
            `${options.remoteLoadMaxAttempts} attempt(s).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: moduleName,
          cause: error,
        });
      },
    },
  );
}

function clampAttempts(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function emitDiagnostic(
  onDiagnostic: ((diagnostic: PluginLoadDiagnostic) => void) | undefined,
  diagnostic: PluginLoadDiagnostic,
): void {
  if (!onDiagnostic) {
    return;
  }

  onDiagnostic(diagnostic);
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function normalizeRemoteContractModule(input: unknown): unknown {
  let candidate = input;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!candidate || typeof candidate !== "object") {
      return candidate;
    }

    const record = candidate as Record<string, unknown>;
    if ("manifest" in record) {
      return candidate;
    }

    const next = resolveContractExport(candidate);
    if (next === candidate) {
      return candidate;
    }

    candidate = next;
  }

  return candidate;
}

interface ExtractedContractModule {
  contractData: unknown;
  activate: PluginActivateFunction | null;
  deactivate: PluginDeactivateExport | null;
  exports: Record<string, Function>;
}

/**
 * Extract contract data and optional activate/deactivate functions from a raw module.
 * The activate and deactivate functions are sidecar exports alongside the contract data.
 */
function extractContractAndActivate(rawModule: unknown): ExtractedContractModule {
  let activate: PluginActivateFunction | null = null;
  let deactivate: PluginDeactivateExport | null = null;
  const exports: Record<string, Function> = {};

  if (rawModule && typeof rawModule === "object") {
    const record = rawModule as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "function") {
        exports[key] = value as Function;
      }
    }
    if (typeof record.activate === "function") {
      activate = record.activate as PluginActivateFunction;
    }
    if (typeof record.deactivate === "function") {
      deactivate = record.deactivate as PluginDeactivateExport;
    }
  }

  const contractData = normalizeRemoteContractModule(rawModule);
  return { contractData, activate, deactivate, exports };
}
