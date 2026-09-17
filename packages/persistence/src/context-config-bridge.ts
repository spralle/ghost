/**
 * Context state config bridge — migrates context state persistence from
 * direct localStorage (unified envelope) to the USER layer of the
 * ConfigurationService.
 *
 * Non-destructive: original localStorage data is never deleted.
 * Idempotent: migration is skipped once the `_migrated_context` flag is set.
 * Fallback: if config service is unavailable, falls back to localStorage.
 */

import type { ConfigurationService } from "@ghost-shell/contracts";
import type { ConfigurationPropertySchema } from "@ghost-shell/contracts/plugin";
import { createInitialShellContextState, type ShellContextState } from "@ghost-shell/state";
import type {
  ContextStateLoadResult,
  ContextStateSaveResult,
  ShellContextStatePersistence,
  StorageLike,
} from "./contracts.js";
import {
  getUnifiedStorageKey,
  loadUnifiedEnvelope,
  mergeAndSaveEnvelope,
  migrateContextStateEnvelope,
} from "./envelope.js";
import { sanitizeContextState } from "./sanitize.js";
import { sanitizeDockTreeStateWithReport } from "./sanitize-dock-tree.js";
import { isRecord } from "./utils.js";

// ---------------------------------------------------------------------------
// Config key & schema
// ---------------------------------------------------------------------------

export const CONTEXT_STATE_CONFIG_KEY = "ghost.shell.contextState";

export const contextStateConfigSchema: ConfigurationPropertySchema & { key: string } = {
  key: CONTEXT_STATE_CONFIG_KEY,
  type: "object",
  description: "Shell context state (groups, selections, dock tree)",
  "x-weaver": { sessionMode: "allowed" },
};

// ---------------------------------------------------------------------------
// Migration flag key in localStorage
// ---------------------------------------------------------------------------

const MIGRATION_FLAG_KEY = "_migrated_context";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ContextConfigBridge {
  /** Load context state from config service (USER layer), falling back to localStorage */
  loadContext(fallback: ShellContextState): ContextStateLoadResult;
  /** Save context state to config service (USER layer), with localStorage fallback */
  saveContext(state: ShellContextState): ContextStateSaveResult;
  /** Migrate existing localStorage context state to config service (idempotent) */
  migrate(): { migrated: boolean; source: "config" | "localStorage" | "none" };
}

export interface ContextConfigBridgeOptions {
  configService: ConfigurationService;
  /** Raw storage handle (localStorage or mock) */
  storage: StorageLike | undefined;
  /** User ID for resolving the unified storage key */
  userId: string;
  /** Config key for context state in config service (default: "ghost.shell.contextState") */
  configKey?: string | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createContextConfigBridge(options: ContextConfigBridgeOptions): ContextConfigBridge {
  const { configService, storage, userId } = options;
  const configKey = options.configKey ?? CONTEXT_STATE_CONFIG_KEY;
  const storageKey = getUnifiedStorageKey(userId);

  return {
    loadContext(fallback: ShellContextState): ContextStateLoadResult {
      const safeFallback = sanitizeContextState(fallback, createInitialShellContextState());

      // 1. Try config service first
      try {
        const fromConfig = configService.get<ShellContextState>(configKey);
        if (fromConfig !== undefined && fromConfig !== null) {
          const sanitized = sanitizeContextState(fromConfig, safeFallback);
          return { state: sanitized, warning: null };
        }
      } catch {
        // Config service unavailable — fall through to localStorage
      }

      // 2. Fall back to localStorage (unified envelope)
      return loadFromStorage(storage, storageKey, safeFallback);
    },

    saveContext(state: ShellContextState): ContextStateSaveResult {
      const safeState = sanitizeContextState(state, createInitialShellContextState());

      // 1. Try config service first
      try {
        configService.set(configKey, safeState, "user");
        return { warning: null };
      } catch {
        // Config service unavailable — fall through to localStorage
      }

      // 2. Fall back: write to localStorage via unified envelope
      return saveToStorage(storage, storageKey, safeState);
    },

    migrate(): { migrated: boolean; source: "config" | "localStorage" | "none" } {
      // Already migrated?
      if (storage && storage.getItem(MIGRATION_FLAG_KEY) === "true") {
        return { migrated: false, source: "none" };
      }

      // Already present in config service?
      try {
        const existing = configService.get<ShellContextState>(configKey);
        if (existing !== undefined && existing !== null) {
          // Mark as migrated so we don't repeat
          setMigrationFlag(storage);
          return { migrated: false, source: "config" };
        }
      } catch {
        // Config service unavailable — cannot migrate
        return { migrated: false, source: "none" };
      }

      // Read from localStorage
      const safeFallback = createInitialShellContextState();
      const fromStorage = loadFromStorage(storage, storageKey, safeFallback);

      // Check if the loaded state is just the default (nothing meaningful to migrate)
      const isDefault = isDefaultContextState(fromStorage.state, safeFallback);
      if (isDefault) {
        setMigrationFlag(storage);
        return { migrated: false, source: "none" };
      }

      // Copy to config service
      try {
        configService.set(configKey, fromStorage.state, "user");
        setMigrationFlag(storage);
        return { migrated: true, source: "localStorage" };
      } catch {
        // Config write failed — leave original untouched, do NOT set flag
        return { migrated: false, source: "none" };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// ShellContextStatePersistence adapter — returns a ShellContextStatePersistence
// backed by the config bridge so callers like ShellRuntime can use it directly.
// ---------------------------------------------------------------------------

export function createConfigBackedContextPersistence(
  options: ContextConfigBridgeOptions,
): ShellContextStatePersistence {
  const bridge = createContextConfigBridge(options);
  return {
    load: (fallback) => bridge.loadContext(fallback),
    save: (state) => bridge.saveContext(state),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadFromStorage(
  storage: StorageLike | undefined,
  storageKey: string,
  safeFallback: ShellContextState,
): ContextStateLoadResult {
  if (!storage) {
    return { state: safeFallback, warning: null };
  }

  const envelope = loadUnifiedEnvelope(storage, storageKey);
  if (envelope.ok) {
    const migration = migrateContextStateEnvelope(envelope.value.context);
    if (migration.ok) {
      const sanitizedState = sanitizeContextState(migration.value.contextState, safeFallback);
      const dockReport = sanitizeDockTreeStateWithReport(
        getDockTreeInput(migration.value.contextState),
        sanitizedState.tabs,
        sanitizedState.tabOrder,
        sanitizedState.activeTabId,
      );
      return {
        state: sanitizedState,
        warning: joinWarnings(migration.warning, dockReport.warning),
      };
    }
  }

  return { state: safeFallback, warning: null };
}

function saveToStorage(
  storage: StorageLike | undefined,
  storageKey: string,
  state: ShellContextState,
): ContextStateSaveResult {
  if (!storage) {
    return { warning: null };
  }

  try {
    mergeAndSaveEnvelope(storage, storageKey, "context", { version: 2 as const, contextState: state });
    return { warning: null };
  } catch {
    return { warning: "Unable to persist context state locally." };
  }
}

function isDefaultContextState(state: ShellContextState, defaults: ShellContextState): boolean {
  // Compare tab counts — a default state has exactly one tab
  const tabIds = Object.keys(state.tabs);
  const defaultTabIds = Object.keys(defaults.tabs);
  if (tabIds.length !== defaultTabIds.length) {
    return false;
  }

  // If there are no selections and no custom lanes, it's default-like
  const hasSelections = Object.keys(state.selectionByEntityType).length > 0;
  const hasGlobalLanes = Object.keys(state.globalLanes).length > 0;
  if (hasSelections || hasGlobalLanes) {
    return false;
  }

  return true;
}

function getDockTreeInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return undefined;
  }
  return input.dockTree;
}

function joinWarnings(first: string | null, second: string | null): string | null {
  if (first && second) {
    return `${first} ${second}`;
  }
  return first ?? second;
}

function setMigrationFlag(storage: StorageLike | undefined): void {
  if (storage) {
    try {
      storage.setItem(MIGRATION_FLAG_KEY, "true");
    } catch {
      // Silently ignore — storage may be full
    }
  }
}
