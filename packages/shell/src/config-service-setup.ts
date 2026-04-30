/**
 * Shell config service setup — creates the ConfigurationService wired with
 * OverrideSession and runs persistence migrations.
 *
 * Extracted from hydratePluginRegistry to keep index.ts focused.
 * Mandatory fallback: if config service creation throws, callers fall back
 * to existing localStorage persistence.
 */

// @weaver/config-types, @weaver/config-providers, @weaver/config-sessions removed.
// Stub types preserve the public API so downstream TypeScript is happy.

import type { ConfigurationService } from "@ghost-shell/contracts";

/** Stub for OverrideSessionController (@weaver/config-sessions removed). */
interface OverrideSessionController {
  [key: string]: unknown;
}

import {
  createContextConfigBridge,
  createKeybindingConfigBridge,
  createLayoutConfigBridge,
} from "@ghost-shell/persistence";
import { getCurrentUserId, getStorage } from "./app/utils.js";

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface ShellConfigServiceResult {
  configService: ConfigurationService;
  sessionController: OverrideSessionController;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function notifyListeners(
  listeners: Map<string, Set<(value: unknown) => void>>,
  key: string,
  value: unknown,
): void {
  const keyListeners = listeners.get(key);
  if (keyListeners) {
    for (const listener of keyListeners) {
      listener(value);
    }
  }
}

/**
 * In-memory ConfigurationService for degraded operation.
 * Stores values in a Map and notifies listeners on changes.
 * Replace with a persistent backend when available.
 * @see armada-1g3r for the broader config service roadmap
 */
function createInMemoryConfigService(): ConfigurationService {
  const store = new Map<string, unknown>();
  const listeners = new Map<string, Set<(value: unknown) => void>>();

  return {
    get<T = unknown>(key: string): T | undefined {
      return store.get(key) as T | undefined;
    },
    getWithDefault<T>(key: string, defaultValue: T): T {
      return (store.get(key) as T) ?? defaultValue;
    },
    getAtLayer<T>(_layer: unknown, key: string): T | undefined {
      return store.get(key) as T | undefined;
    },
    getForScope<T>(key: string, _scopePath: unknown[]): T | undefined {
      return store.get(key) as T | undefined;
    },
    inspect<T>(key: string) {
      const value = store.get(key) as T | undefined;
      return {
        key,
        effectiveValue: value,
        effectiveLayer: "memory" as const,
        layerValues: { memory: value },
      };
    },
    set(key: string, value: unknown): void {
      store.set(key, value);
      notifyListeners(listeners, key, value);
    },
    remove(key: string, _layer: unknown): void {
      store.delete(key);
      notifyListeners(listeners, key, undefined);
    },
    onChange(key: string, listener: (value: unknown) => void): () => void {
      let keyListeners = listeners.get(key);
      if (!keyListeners) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
      }
      keyListeners.add(listener);
      return () => {
        keyListeners.delete(listener);
      };
    },
    getNamespace(prefix: string): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [k, v] of store) {
        if (k.startsWith(prefix)) {
          result[k] = v;
        }
      }
      return result;
    },
  };
}

/**
 * Create the shell's ConfigurationService.
 * Returns a no-op stub since @weaver packages were removed.
 * Hydration continues normally; config-dependent features degrade gracefully.
 */
export async function createShellConfigService(): Promise<ShellConfigServiceResult> {
  return { configService: createInMemoryConfigService(), sessionController: {} };
}

// ---------------------------------------------------------------------------
// Persistence migration runner
// ---------------------------------------------------------------------------

export interface MigrationResults {
  layout: { migrated: boolean; source: string };
  context: { migrated: boolean; source: string };
  keybindings: { migrated: boolean; source: string };
}

/**
 * Run persistence migrations for layout, context, and keybindings.
 * Each migration is idempotent and non-destructive.
 * Failures are caught per-bridge so one failure doesn't block others.
 */
export function runPersistenceMigrations(configService: ConfigurationService): MigrationResults {
  const storage = getStorage();
  const userId = getCurrentUserId();
  const bridgeOptions = { configService, storage, userId };

  const results: MigrationResults = {
    layout: { migrated: false, source: "none" },
    context: { migrated: false, source: "none" },
    keybindings: { migrated: false, source: "none" },
  };

  try {
    const layoutBridge = createLayoutConfigBridge(bridgeOptions);
    results.layout = layoutBridge.migrate();
  } catch (error) {
    console.warn("[shell:config:migration] layout migration failed", error);
  }

  try {
    const contextBridge = createContextConfigBridge(bridgeOptions);
    results.context = contextBridge.migrate();
  } catch (error) {
    console.warn("[shell:config:migration] context migration failed", error);
  }

  try {
    const keybindingBridge = createKeybindingConfigBridge(bridgeOptions);
    results.keybindings = keybindingBridge.migrate();
  } catch (error) {
    console.warn("[shell:config:migration] keybinding migration failed", error);
  }

  return results;
}
