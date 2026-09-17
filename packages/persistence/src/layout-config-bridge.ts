/**
 * Layout config bridge — migrates layout persistence from direct localStorage
 * (unified envelope) to the USER layer of the ConfigurationService.
 *
 * Non-destructive: original localStorage data is never deleted.
 * Idempotent: migration is skipped once the `_migrated_layout` flag is set.
 * Fallback: if config service is unavailable, falls back to localStorage.
 */

import type { ConfigurationService } from "@ghost-shell/contracts";
import type { ConfigurationPropertySchema } from "@ghost-shell/contracts/plugin";
import {
  createDefaultLayoutState,
  type PartialLayoutState,
  type ShellLayoutState,
  sanitizeLayoutState,
} from "@ghost-shell/state";
import type { ShellLayoutPersistence, StorageLike } from "./contracts.js";
import {
  getUnifiedStorageKey,
  loadUnifiedEnvelope,
  mergeAndSaveEnvelope,
  migrateLayoutSectionEnvelope,
} from "./envelope.js";

// ---------------------------------------------------------------------------
// Config key & schema
// ---------------------------------------------------------------------------

export const LAYOUT_CONFIG_KEY = "ghost.shell.layout";

export const layoutConfigSchema: ConfigurationPropertySchema & { key: string } = {
  key: LAYOUT_CONFIG_KEY,
  type: "object",
  description: "Shell layout state (dock pane sizes)",
  "x-weaver": { sessionMode: "allowed" },
  properties: {
    sideSize: {
      type: "number",
      description: "Side pane width as a ratio of viewport width (0.15–0.45)",
      minimum: 0.15,
      maximum: 0.45,
    },
    secondarySize: {
      type: "number",
      description: "Secondary pane height as a ratio of container height (0.2–0.65)",
      minimum: 0.2,
      maximum: 0.65,
    },
  },
};

// ---------------------------------------------------------------------------
// Migration flag key in localStorage
// ---------------------------------------------------------------------------

const MIGRATION_FLAG_KEY = "_migrated_layout";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface LayoutConfigBridge {
  /** Load layout from config service (USER layer), falling back to localStorage */
  loadLayout(): ShellLayoutState;
  /** Save layout to config service (USER layer), with localStorage fallback */
  saveLayout(layout: ShellLayoutState): void;
  /** Migrate existing localStorage layout to config service (idempotent) */
  migrate(): { migrated: boolean; source: "config" | "localStorage" | "none" };
}

export interface LayoutConfigBridgeOptions {
  configService: ConfigurationService;
  /** Raw storage handle (localStorage or mock) */
  storage: StorageLike | undefined;
  /** User ID for resolving the unified storage key */
  userId: string;
  /** Config key for layout in config service (default: "ghost.shell.layout") */
  configKey?: string | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createLayoutConfigBridge(options: LayoutConfigBridgeOptions): LayoutConfigBridge {
  const { configService, storage, userId } = options;
  const configKey = options.configKey ?? LAYOUT_CONFIG_KEY;
  const storageKey = getUnifiedStorageKey(userId);

  return {
    loadLayout(): ShellLayoutState {
      // 1. Try config service first
      try {
        const fromConfig = configService.get<ShellLayoutState>(configKey);
        if (fromConfig !== undefined && fromConfig !== null) {
          return sanitizeLayoutState(fromConfig as PartialLayoutState);
        }
      } catch {
        // Config service unavailable — fall through to localStorage
      }

      // 2. Fall back to localStorage (unified envelope)
      return loadFromStorage(storage, storageKey);
    },

    saveLayout(layout: ShellLayoutState): void {
      const safeState = sanitizeLayoutState(layout);

      // 1. Try config service first
      try {
        configService.set(configKey, safeState, "user");
        return;
      } catch {
        // Config service unavailable — fall through to localStorage
      }

      // 2. Fall back: write to localStorage via unified envelope
      saveToStorage(storage, storageKey, safeState);
    },

    migrate(): { migrated: boolean; source: "config" | "localStorage" | "none" } {
      // Already migrated?
      if (storage && storage.getItem(MIGRATION_FLAG_KEY) === "true") {
        return { migrated: false, source: "none" };
      }

      // Already present in config service?
      try {
        const existing = configService.get<ShellLayoutState>(configKey);
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
      const fromStorage = loadFromStorage(storage, storageKey);
      const defaults = createDefaultLayoutState();
      const isDefault =
        fromStorage.sideSize === defaults.sideSize && fromStorage.secondarySize === defaults.secondarySize;

      if (isDefault) {
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
// ShellLayoutPersistence adapter — returns a ShellLayoutPersistence backed
// by the config bridge so callers like ShellRuntime can use it directly.
// ---------------------------------------------------------------------------

export function createConfigBackedLayoutPersistence(options: LayoutConfigBridgeOptions): ShellLayoutPersistence {
  const bridge = createLayoutConfigBridge(options);
  return {
    load: () => bridge.loadLayout(),
    save: (state) => bridge.saveLayout(state),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadFromStorage(storage: StorageLike | undefined, storageKey: string): ShellLayoutState {
  if (!storage) {
    return createDefaultLayoutState();
  }

  const envelope = loadUnifiedEnvelope(storage, storageKey);
  if (envelope.ok) {
    const section = migrateLayoutSectionEnvelope(envelope.value.layout);
    if (section.ok) {
      return sanitizeLayoutState(section.value.state as PartialLayoutState);
    }
  }

  return createDefaultLayoutState();
}

function saveToStorage(storage: StorageLike | undefined, storageKey: string, state: ShellLayoutState): void {
  if (!storage) {
    return;
  }

  mergeAndSaveEnvelope(storage, storageKey, "layout", { version: 1 as const, state });
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
