import assert from "node:assert/strict";
import test from "node:test";
import {
  createLayoutConfigBridge,
  LAYOUT_CONFIG_KEY,
  layoutConfigSchema,
} from "../../../packages/persistence/src/layout-config-bridge.js";

// ---------------------------------------------------------------------------
// Stub ConfigurationService — minimal mock
// ---------------------------------------------------------------------------

function createStubConfigService(entries = {}) {
  const store = { ...entries };
  return {
    get(key) {
      return Object.hasOwn(store, key) ? store[key] : undefined;
    },
    getWithDefault(key, defaultValue) {
      const v = store[key];
      return v !== undefined ? v : defaultValue;
    },
    getAtLayer() {
      return undefined;
    },
    getForScope() {
      return undefined;
    },
    inspect(key) {
      return { key, effectiveValue: store[key], effectiveLayer: undefined };
    },
    set(key, value) {
      store[key] = value;
    },
    remove(key) {
      delete store[key];
    },
    onChange() {
      return () => {};
    },
    getNamespace() {
      return {};
    },
    /** Expose internal store for assertions */
    _store: store,
  };
}

/**
 * Stub ConfigurationService that throws on set() — simulates unavailable service
 */
function createFailingConfigService(entries = {}) {
  const svc = createStubConfigService(entries);
  svc.set = () => {
    throw new Error("Config service unavailable");
  };
  return svc;
}

/**
 * Stub ConfigurationService that throws on both get() and set()
 */
function createFullyBrokenConfigService() {
  return {
    get() {
      throw new Error("Config service unavailable");
    },
    getWithDefault() {
      throw new Error("Config service unavailable");
    },
    getAtLayer() {
      return undefined;
    },
    getForScope() {
      return undefined;
    },
    inspect() {
      throw new Error("Config service unavailable");
    },
    set() {
      throw new Error("Config service unavailable");
    },
    remove() {
      throw new Error("Config service unavailable");
    },
    onChange() {
      return () => {};
    },
    getNamespace() {
      return {};
    },
  };
}

// ---------------------------------------------------------------------------
// Stub StorageLike — in-memory localStorage replacement
// ---------------------------------------------------------------------------

function createStubStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    _data: data,
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CUSTOM_LAYOUT = { sideSize: 0.3, secondarySize: 0.5 };
const DEFAULT_LAYOUT = { sideSize: 0.24, secondarySize: 0.35 };
const USER_ID = "test-user";

function makeStorageEnvelope(layout) {
  return JSON.stringify({
    version: 1,
    layout: { version: 1, state: layout },
  });
}

function storageKeyForUser(userId) {
  return `ghost.shell.persistence.v1.${userId}`;
}

// ---------------------------------------------------------------------------
// 1. Schema declaration
// ---------------------------------------------------------------------------

test("layoutConfigSchema has correct key and type", () => {
  assert.equal(layoutConfigSchema.key, "ghost.shell.layout");
  assert.equal(layoutConfigSchema.type, "object");
  assert.ok(layoutConfigSchema.description);
  assert.equal(layoutConfigSchema["x-weaver"].sessionMode, "allowed");
});

test("layoutConfigSchema declares sideSize and secondarySize properties", () => {
  const props = layoutConfigSchema.properties;
  assert.ok(props);
  assert.ok(props.sideSize);
  assert.ok(props.secondarySize);
  assert.equal(props.sideSize.type, "number");
  assert.equal(props.secondarySize.type, "number");
});

// ---------------------------------------------------------------------------
// 2. migrate() — copies layout from localStorage to config service
// ---------------------------------------------------------------------------

test("migrate() copies layout from localStorage to config service", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeStorageEnvelope(CUSTOM_LAYOUT),
  });
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();

  assert.equal(result.migrated, true);
  assert.equal(result.source, "localStorage");

  // Verify data was written to config service
  const saved = configService._store[LAYOUT_CONFIG_KEY];
  assert.ok(saved);
  assert.equal(saved.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(saved.secondarySize, CUSTOM_LAYOUT.secondarySize);

  // Verify migration flag was set
  assert.equal(storage.getItem("_migrated_layout"), "true");
});

// ---------------------------------------------------------------------------
// 3. migrate() — idempotent (second call skips)
// ---------------------------------------------------------------------------

test("migrate() is idempotent — second call returns migrated=false", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeStorageEnvelope(CUSTOM_LAYOUT),
  });
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const first = bridge.migrate();
  assert.equal(first.migrated, true);

  const second = bridge.migrate();
  assert.equal(second.migrated, false);
  assert.equal(second.source, "none");
});

// ---------------------------------------------------------------------------
// 4. migrate() — handles missing localStorage data gracefully
// ---------------------------------------------------------------------------

test("migrate() handles missing localStorage data gracefully", () => {
  const storage = createStubStorage(); // empty
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();

  // Default layout should not be migrated — nothing meaningful
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");
});

test("migrate() handles undefined storage gracefully", () => {
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage: undefined,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");
});

// ---------------------------------------------------------------------------
// 5. migrate() — skips when config already has data
// ---------------------------------------------------------------------------

test("migrate() skips when config service already has layout data", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeStorageEnvelope(CUSTOM_LAYOUT),
  });
  const configService = createStubConfigService({
    [LAYOUT_CONFIG_KEY]: { sideSize: 0.2, secondarySize: 0.4 },
  });

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "config");

  // Migration flag should still be set
  assert.equal(storage.getItem("_migrated_layout"), "true");
});

// ---------------------------------------------------------------------------
// 6. migrate() — config write failure does NOT set flag
// ---------------------------------------------------------------------------

test("migrate() does not set flag when config service write fails", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeStorageEnvelope(CUSTOM_LAYOUT),
  });
  const configService = createFailingConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");

  // Flag should NOT be set — we can retry next time
  assert.equal(storage.getItem("_migrated_layout"), null);
});

// ---------------------------------------------------------------------------
// 7. loadLayout() — reads from config service
// ---------------------------------------------------------------------------

test("loadLayout() reads from config service when data exists", () => {
  const configService = createStubConfigService({
    [LAYOUT_CONFIG_KEY]: CUSTOM_LAYOUT,
  });

  const bridge = createLayoutConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const layout = bridge.loadLayout();
  assert.equal(layout.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(layout.secondarySize, CUSTOM_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 8. loadLayout() — falls back to localStorage when config service returns null
// ---------------------------------------------------------------------------

test("loadLayout() falls back to localStorage when config service returns undefined", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeStorageEnvelope(CUSTOM_LAYOUT),
  });
  const configService = createStubConfigService(); // empty — get returns undefined

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const layout = bridge.loadLayout();
  assert.equal(layout.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(layout.secondarySize, CUSTOM_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 9. loadLayout() — falls back to localStorage when config service throws
// ---------------------------------------------------------------------------

test("loadLayout() falls back to localStorage when config service throws", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeStorageEnvelope(CUSTOM_LAYOUT),
  });
  const configService = createFullyBrokenConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const layout = bridge.loadLayout();
  assert.equal(layout.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(layout.secondarySize, CUSTOM_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 10. loadLayout() — returns default when both sources are empty
// ---------------------------------------------------------------------------

test("loadLayout() returns default layout when both sources are empty", () => {
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const layout = bridge.loadLayout();
  assert.equal(layout.sideSize, DEFAULT_LAYOUT.sideSize);
  assert.equal(layout.secondarySize, DEFAULT_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 11. saveLayout() — writes to config service
// ---------------------------------------------------------------------------

test("saveLayout() writes to config service", () => {
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  bridge.saveLayout(CUSTOM_LAYOUT);

  const saved = configService._store[LAYOUT_CONFIG_KEY];
  assert.ok(saved);
  assert.equal(saved.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(saved.secondarySize, CUSTOM_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 12. saveLayout() — falls back to localStorage when config service throws
// ---------------------------------------------------------------------------

test("saveLayout() falls back to localStorage when config service throws", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage();
  const configService = createFailingConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  bridge.saveLayout(CUSTOM_LAYOUT);

  // Should have been written to localStorage via unified envelope
  const raw = storage.getItem(storageKey);
  assert.ok(raw);
  const envelope = JSON.parse(raw);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.layout.version, 1);
  assert.equal(envelope.layout.state.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(envelope.layout.state.secondarySize, CUSTOM_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 13. saveLayout() — sanitizes input
// ---------------------------------------------------------------------------

test("saveLayout() sanitizes out-of-range values before persisting", () => {
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  // Values outside valid range
  bridge.saveLayout({ sideSize: 0.9, secondarySize: 0.01 });

  const saved = configService._store[LAYOUT_CONFIG_KEY];
  assert.ok(saved);
  // Should be clamped to [0.15, 0.45] and [0.2, 0.65]
  assert.equal(saved.sideSize, 0.45);
  assert.equal(saved.secondarySize, 0.2);
});

// ---------------------------------------------------------------------------
// 14. Custom config key
// ---------------------------------------------------------------------------

test("createLayoutConfigBridge supports custom configKey", () => {
  const customKey = "custom.layout.key";
  const configService = createStubConfigService({
    [customKey]: CUSTOM_LAYOUT,
  });

  const bridge = createLayoutConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
    configKey: customKey,
  });

  const layout = bridge.loadLayout();
  assert.equal(layout.sideSize, CUSTOM_LAYOUT.sideSize);
  assert.equal(layout.secondarySize, CUSTOM_LAYOUT.secondarySize);
});

// ---------------------------------------------------------------------------
// 15. Non-destructive — original localStorage data is preserved
// ---------------------------------------------------------------------------

test("migrate() preserves original localStorage data after migration", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const originalEnvelope = makeStorageEnvelope(CUSTOM_LAYOUT);
  const storage = createStubStorage({
    [storageKey]: originalEnvelope,
  });
  const configService = createStubConfigService();

  const bridge = createLayoutConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  bridge.migrate();

  // Original localStorage data must still be intact
  assert.equal(storage.getItem(storageKey), originalEnvelope);
});

// ---------------------------------------------------------------------------
// 16. loadLayout() sanitizes corrupted config data
// ---------------------------------------------------------------------------

test("loadLayout() sanitizes corrupted config data", () => {
  const configService = createStubConfigService({
    [LAYOUT_CONFIG_KEY]: { sideSize: "not-a-number", secondarySize: null },
  });

  const bridge = createLayoutConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const layout = bridge.loadLayout();
  // Should fall back to defaults for invalid values
  assert.equal(layout.sideSize, DEFAULT_LAYOUT.sideSize);
  assert.equal(layout.secondarySize, DEFAULT_LAYOUT.secondarySize);
});
