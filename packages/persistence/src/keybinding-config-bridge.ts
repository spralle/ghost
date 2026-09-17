/**
 * Keybinding config bridge — migrates keybinding customizations from
 * direct localStorage (unified envelope) to the USER layer of the
 * ConfigurationService.
 *
 * Non-destructive: original localStorage data is never deleted.
 * Idempotent: migration is skipped once the `_migrated_keybindings` flag is set.
 * Fallback: if config service is unavailable, falls back to localStorage.
 */

import type { ConfigurationService } from "@ghost-shell/contracts";
import type { ConfigurationPropertySchema } from "@ghost-shell/contracts/plugin";
import type {
  KeybindingOverrideEntryV1,
  KeybindingOverridesEnvelopeV1,
  ShellKeybindingPersistence,
  StorageLike,
} from "./contracts.js";
import {
  getUnifiedStorageKey,
  KEYBINDING_OVERRIDES_SCHEMA_VERSION,
  loadUnifiedEnvelope,
  mergeAndSaveEnvelope,
  migrateKeybindingOverridesEnvelope,
} from "./envelope.js";

// ---------------------------------------------------------------------------
// Config key & schema
// ---------------------------------------------------------------------------

export const KEYBINDING_CONFIG_KEY = "ghost.shell.keybindingOverrides";

export const keybindingConfigSchema: ConfigurationPropertySchema & { key: string } = {
  key: KEYBINDING_CONFIG_KEY,
  type: "object",
  description: "User keybinding customizations",
  "x-weaver": { sessionMode: "allowed" },
};

// ---------------------------------------------------------------------------
// Migration flag key in localStorage
// ---------------------------------------------------------------------------

const MIGRATION_FLAG_KEY = "_migrated_keybindings";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface KeybindingConfigBridge {
  /** Load keybinding overrides from config service (USER layer), falling back to localStorage */
  load(): KeybindingOverrideEntryV1[];
  /** Save keybinding overrides to config service (USER layer), with localStorage fallback */
  save(overrides: KeybindingOverrideEntryV1[]): { warning: string | null };
  /** Migrate existing localStorage keybindings to config service (idempotent) */
  migrate(): { migrated: boolean; source: "config" | "localStorage" | "none" };
}

export interface KeybindingConfigBridgeOptions {
  configService: ConfigurationService;
  /** Raw storage handle (localStorage or mock) */
  storage: StorageLike | undefined;
  /** User ID for resolving the unified storage key */
  userId: string;
  /** Config key for keybinding overrides in config service (default: "ghost.shell.keybindingOverrides") */
  configKey?: string | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKeybindingConfigBridge(options: KeybindingConfigBridgeOptions): KeybindingConfigBridge {
  const { configService, storage, userId } = options;
  const configKey = options.configKey ?? KEYBINDING_CONFIG_KEY;
  const storageKey = getUnifiedStorageKey(userId);

  return {
    load(): KeybindingOverrideEntryV1[] {
      // 1. Try config service first
      try {
        const fromConfig = configService.get<KeybindingOverrideEntryV1[]>(configKey);
        if (fromConfig !== undefined && fromConfig !== null) {
          return sanitizeOverrideEntries(Array.isArray(fromConfig) ? fromConfig : []);
        }
      } catch {
        // Config service unavailable — fall through to localStorage
      }

      // 2. Fall back to localStorage (unified envelope)
      return loadFromStorage(storage, storageKey);
    },

    save(overrides: KeybindingOverrideEntryV1[]): { warning: string | null } {
      const safeOverrides = sanitizeOverrideEntries(overrides);

      // 1. Try config service first
      try {
        configService.set(configKey, safeOverrides, "user");
        return { warning: null };
      } catch {
        // Config service unavailable — fall through to localStorage
      }

      // 2. Fall back: write to localStorage via unified envelope
      return saveToStorage(storage, storageKey, safeOverrides);
    },

    migrate(): { migrated: boolean; source: "config" | "localStorage" | "none" } {
      // Already migrated?
      if (storage && storage.getItem(MIGRATION_FLAG_KEY) === "true") {
        return { migrated: false, source: "none" };
      }

      // Already present in config service?
      try {
        const existing = configService.get<KeybindingOverrideEntryV1[]>(configKey);
        if (existing !== undefined && existing !== null) {
          setMigrationFlag(storage);
          return { migrated: false, source: "config" };
        }
      } catch {
        // Config service unavailable — cannot migrate
        return { migrated: false, source: "none" };
      }

      // Read from localStorage
      const fromStorage = loadFromStorage(storage, storageKey);
      if (fromStorage.length === 0) {
        // Nothing meaningful to migrate
        setMigrationFlag(storage);
        return { migrated: false, source: "none" };
      }

      // Copy to config service
      try {
        configService.set(configKey, fromStorage, "user");
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
// ShellKeybindingPersistence adapter — returns a ShellKeybindingPersistence
// backed by the config bridge so callers like ShellRuntime can use it directly.
// ---------------------------------------------------------------------------

export function createConfigBackedKeybindingPersistence(
  options: KeybindingConfigBridgeOptions,
): ShellKeybindingPersistence {
  const bridge = createKeybindingConfigBridge(options);
  return {
    load: () => bridge.load(),
    save: (overrides) => bridge.save(overrides),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadFromStorage(storage: StorageLike | undefined, storageKey: string): KeybindingOverrideEntryV1[] {
  if (!storage) {
    return [];
  }

  const envelope = loadUnifiedEnvelope(storage, storageKey);
  if (!envelope.ok) {
    return [];
  }

  const migration = migrateKeybindingOverridesEnvelope(envelope.value.keybindings);
  if (!migration.ok) {
    return [];
  }

  return sanitizeOverrideEntries(migration.value.overrides);
}

function saveToStorage(
  storage: StorageLike | undefined,
  storageKey: string,
  overrides: KeybindingOverrideEntryV1[],
): { warning: string | null } {
  if (!storage) {
    return { warning: null };
  }

  const keybindingsEnvelope: KeybindingOverridesEnvelopeV1 = {
    version: KEYBINDING_OVERRIDES_SCHEMA_VERSION,
    overrides,
  };

  try {
    mergeAndSaveEnvelope(storage, storageKey, "keybindings", keybindingsEnvelope);
    return { warning: null };
  } catch {
    return { warning: "Unable to persist keybinding overrides locally." };
  }
}

function sanitizeOverrideEntries(entries: KeybindingOverrideEntryV1[]): KeybindingOverrideEntryV1[] {
  return entries.filter(
    (entry) =>
      typeof entry.action === "string" &&
      entry.action.length > 0 &&
      typeof entry.keybinding === "string" &&
      entry.keybinding.length > 0,
  );
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
