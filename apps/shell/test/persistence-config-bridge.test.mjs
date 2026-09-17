import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTEXT_STATE_CONFIG_KEY,
  contextStateConfigSchema,
  createContextConfigBridge,
} from "../../../packages/persistence/src/context-config-bridge.js";
import {
  createKeybindingConfigBridge,
  KEYBINDING_CONFIG_KEY,
  keybindingConfigSchema,
} from "../../../packages/persistence/src/keybinding-config-bridge.js";

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

const USER_ID = "test-user";

function storageKeyForUser(userId) {
  return `ghost.shell.persistence.v1.${userId}`;
}

function makeContextEnvelope(contextState) {
  return JSON.stringify({
    version: 1,
    context: { version: 2, contextState },
  });
}

function makeKeybindingEnvelope(overrides) {
  return JSON.stringify({
    version: 1,
    keybindings: { version: 1, overrides },
  });
}

// A non-default context state (has selections and multiple tabs)
const CUSTOM_CONTEXT_STATE = {
  groups: { "group-main": { id: "group-main", color: "blue" } },
  tabs: {
    "tab-main": {
      id: "tab-main",
      definitionId: "tab-main",
      partDefinitionId: "tab-main",
      groupId: "group-main",
      label: "Main",
      closePolicy: "fixed",
      args: {},
    },
    "tab-orders": {
      id: "tab-orders",
      definitionId: "tab-orders",
      partDefinitionId: "tab-orders",
      groupId: "group-main",
      label: "Orders",
      closePolicy: "closeable",
      args: {},
    },
  },
  tabOrder: ["tab-main", "tab-orders"],
  activeTabId: "tab-main",
  dockTree: { type: "leaf", tabId: "tab-main" },
  closedTabHistoryBySlot: { main: [], secondary: [], side: [] },
  globalLanes: {},
  groupLanes: { "group-main": {} },
  subcontextsByTab: {},
  selectionByEntityType: {
    vessel: { selectedIds: ["v-1"], priorityId: "v-1" },
  },
};

const FALLBACK_CONTEXT_STATE = {
  groups: { "group-main": { id: "group-main", color: "blue" } },
  tabs: {
    "tab-fallback": {
      id: "tab-fallback",
      definitionId: "tab-fallback",
      partDefinitionId: "tab-fallback",
      groupId: "group-main",
      label: "Fallback",
      closePolicy: "fixed",
      args: {},
    },
  },
  tabOrder: ["tab-fallback"],
  activeTabId: "tab-fallback",
  dockTree: { type: "leaf", tabId: "tab-fallback" },
  closedTabHistoryBySlot: { main: [], secondary: [], side: [] },
  globalLanes: {},
  groupLanes: { "group-main": {} },
  subcontextsByTab: {},
  selectionByEntityType: {},
};

const CUSTOM_KEYBINDINGS = [
  { action: "shell.focus.left", keybinding: "ctrl+h" },
  { action: "shell.focus.right", keybinding: "ctrl+l", removed: true },
];

// ===========================================================================
// CONTEXT CONFIG BRIDGE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Schema declaration
// ---------------------------------------------------------------------------

test("contextStateConfigSchema has correct key and type", () => {
  assert.equal(contextStateConfigSchema.key, "ghost.shell.contextState");
  assert.equal(contextStateConfigSchema.type, "object");
  assert.ok(contextStateConfigSchema.description);
  assert.equal(contextStateConfigSchema["x-weaver"].sessionMode, "allowed");
});

// ---------------------------------------------------------------------------
// 2. migrate() — copies context from localStorage to config service
// ---------------------------------------------------------------------------

test("context: migrate() copies context from localStorage to config service", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeContextEnvelope(CUSTOM_CONTEXT_STATE),
  });
  const configService = createStubConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();

  assert.equal(result.migrated, true);
  assert.equal(result.source, "localStorage");

  // Verify data was written to config service
  const saved = configService._store[CONTEXT_STATE_CONFIG_KEY];
  assert.ok(saved);
  assert.ok(saved.tabs["tab-main"]);
  assert.ok(saved.tabs["tab-orders"]);

  // Verify migration flag was set
  assert.equal(storage.getItem("_migrated_context"), "true");
});

// ---------------------------------------------------------------------------
// 3. migrate() — idempotent (second call skips)
// ---------------------------------------------------------------------------

test("context: migrate() is idempotent — second call returns migrated=false", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeContextEnvelope(CUSTOM_CONTEXT_STATE),
  });
  const configService = createStubConfigService();

  const bridge = createContextConfigBridge({
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
// 4. migrate() — handles empty localStorage gracefully
// ---------------------------------------------------------------------------

test("context: migrate() handles missing localStorage data gracefully", () => {
  const storage = createStubStorage(); // empty
  const configService = createStubConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");
});

// ---------------------------------------------------------------------------
// 5. migrate() — skips when config already has data
// ---------------------------------------------------------------------------

test("context: migrate() skips when config service already has data", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeContextEnvelope(CUSTOM_CONTEXT_STATE),
  });
  const configService = createStubConfigService({
    [CONTEXT_STATE_CONFIG_KEY]: CUSTOM_CONTEXT_STATE,
  });

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "config");
  assert.equal(storage.getItem("_migrated_context"), "true");
});

// ---------------------------------------------------------------------------
// 6. migrate() — config write failure does NOT set flag
// ---------------------------------------------------------------------------

test("context: migrate() does not set flag when config service write fails", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeContextEnvelope(CUSTOM_CONTEXT_STATE),
  });
  const configService = createFailingConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");
  assert.equal(storage.getItem("_migrated_context"), null);
});

// ---------------------------------------------------------------------------
// 7. loadContext() — reads from config service
// ---------------------------------------------------------------------------

test("context: loadContext() reads from config service when data exists", () => {
  const configService = createStubConfigService({
    [CONTEXT_STATE_CONFIG_KEY]: CUSTOM_CONTEXT_STATE,
  });

  const bridge = createContextConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const result = bridge.loadContext(FALLBACK_CONTEXT_STATE);
  assert.ok(result.state.tabs["tab-main"]);
  assert.ok(result.state.tabs["tab-orders"]);
  assert.equal(result.warning, null);
});

// ---------------------------------------------------------------------------
// 8. loadContext() — falls back to localStorage when config empty
// ---------------------------------------------------------------------------

test("context: loadContext() falls back to localStorage when config service returns undefined", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeContextEnvelope(CUSTOM_CONTEXT_STATE),
  });
  const configService = createStubConfigService(); // empty

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.loadContext(FALLBACK_CONTEXT_STATE);
  assert.ok(result.state.tabs["tab-main"]);
  assert.ok(result.state.tabs["tab-orders"]);
});

// ---------------------------------------------------------------------------
// 9. loadContext() — falls back when config service throws
// ---------------------------------------------------------------------------

test("context: loadContext() falls back to localStorage when config service throws", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeContextEnvelope(CUSTOM_CONTEXT_STATE),
  });
  const configService = createFullyBrokenConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.loadContext(FALLBACK_CONTEXT_STATE);
  assert.ok(result.state.tabs["tab-main"]);
});

// ---------------------------------------------------------------------------
// 10. saveContext() — writes to config service
// ---------------------------------------------------------------------------

test("context: saveContext() writes to config service", () => {
  const configService = createStubConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const result = bridge.saveContext(CUSTOM_CONTEXT_STATE);
  assert.equal(result.warning, null);

  const saved = configService._store[CONTEXT_STATE_CONFIG_KEY];
  assert.ok(saved);
  assert.ok(saved.tabs["tab-main"]);
});

// ---------------------------------------------------------------------------
// 11. saveContext() — falls back to localStorage when config throws
// ---------------------------------------------------------------------------

test("context: saveContext() falls back to localStorage when config service throws", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage();
  const configService = createFailingConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.saveContext(CUSTOM_CONTEXT_STATE);
  assert.equal(result.warning, null);

  const raw = storage.getItem(storageKey);
  assert.ok(raw);
  const envelope = JSON.parse(raw);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.context.version, 2);
  assert.ok(envelope.context.contextState.tabs);
});

// ---------------------------------------------------------------------------
// 12. Non-destructive — original localStorage data preserved
// ---------------------------------------------------------------------------

test("context: migrate() preserves original localStorage data after migration", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const originalEnvelope = makeContextEnvelope(CUSTOM_CONTEXT_STATE);
  const storage = createStubStorage({
    [storageKey]: originalEnvelope,
  });
  const configService = createStubConfigService();

  const bridge = createContextConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  bridge.migrate();

  // Original localStorage data must still be intact
  assert.equal(storage.getItem(storageKey), originalEnvelope);
});

// ===========================================================================
// KEYBINDING CONFIG BRIDGE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// 13. Schema declaration
// ---------------------------------------------------------------------------

test("keybindingConfigSchema has correct key and type", () => {
  assert.equal(keybindingConfigSchema.key, "ghost.shell.keybindingOverrides");
  assert.equal(keybindingConfigSchema.type, "object");
  assert.ok(keybindingConfigSchema.description);
  assert.equal(keybindingConfigSchema["x-weaver"].sessionMode, "allowed");
});

// ---------------------------------------------------------------------------
// 14. migrate() — copies keybindings from localStorage to config service
// ---------------------------------------------------------------------------

test("keybinding: migrate() copies overrides from localStorage to config service", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeKeybindingEnvelope(CUSTOM_KEYBINDINGS),
  });
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();

  assert.equal(result.migrated, true);
  assert.equal(result.source, "localStorage");

  const saved = configService._store[KEYBINDING_CONFIG_KEY];
  assert.ok(Array.isArray(saved));
  assert.equal(saved.length, 2);
  assert.equal(saved[0].action, "shell.focus.left");

  assert.equal(storage.getItem("_migrated_keybindings"), "true");
});

// ---------------------------------------------------------------------------
// 15. migrate() — idempotent
// ---------------------------------------------------------------------------

test("keybinding: migrate() is idempotent — second call returns migrated=false", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeKeybindingEnvelope(CUSTOM_KEYBINDINGS),
  });
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
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
// 16. migrate() — handles empty localStorage
// ---------------------------------------------------------------------------

test("keybinding: migrate() handles empty localStorage gracefully", () => {
  const storage = createStubStorage();
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");
});

// ---------------------------------------------------------------------------
// 17. migrate() — config write failure does NOT set flag
// ---------------------------------------------------------------------------

test("keybinding: migrate() does not set flag when config service write fails", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeKeybindingEnvelope(CUSTOM_KEYBINDINGS),
  });
  const configService = createFailingConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.source, "none");
  assert.equal(storage.getItem("_migrated_keybindings"), null);
});

// ---------------------------------------------------------------------------
// 18. load() — reads from config service
// ---------------------------------------------------------------------------

test("keybinding: load() reads from config service when data exists", () => {
  const configService = createStubConfigService({
    [KEYBINDING_CONFIG_KEY]: CUSTOM_KEYBINDINGS,
  });

  const bridge = createKeybindingConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const result = bridge.load();
  assert.equal(result.length, 2);
  assert.equal(result[0].action, "shell.focus.left");
  assert.equal(result[1].removed, true);
});

// ---------------------------------------------------------------------------
// 19. load() — falls back to localStorage
// ---------------------------------------------------------------------------

test("keybinding: load() falls back to localStorage when config service returns undefined", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeKeybindingEnvelope(CUSTOM_KEYBINDINGS),
  });
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.load();
  assert.equal(result.length, 2);
  assert.equal(result[0].action, "shell.focus.left");
});

// ---------------------------------------------------------------------------
// 20. load() — falls back when config service throws
// ---------------------------------------------------------------------------

test("keybinding: load() falls back to localStorage when config service throws", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage({
    [storageKey]: makeKeybindingEnvelope(CUSTOM_KEYBINDINGS),
  });
  const configService = createFullyBrokenConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.load();
  assert.equal(result.length, 2);
});

// ---------------------------------------------------------------------------
// 21. save() — writes to config service
// ---------------------------------------------------------------------------

test("keybinding: save() writes to config service", () => {
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const result = bridge.save(CUSTOM_KEYBINDINGS);
  assert.equal(result.warning, null);

  const saved = configService._store[KEYBINDING_CONFIG_KEY];
  assert.ok(Array.isArray(saved));
  assert.equal(saved.length, 2);
});

// ---------------------------------------------------------------------------
// 22. save() — falls back to localStorage when config throws
// ---------------------------------------------------------------------------

test("keybinding: save() falls back to localStorage when config service throws", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const storage = createStubStorage();
  const configService = createFailingConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  const result = bridge.save(CUSTOM_KEYBINDINGS);
  assert.equal(result.warning, null);

  const raw = storage.getItem(storageKey);
  assert.ok(raw);
  const envelope = JSON.parse(raw);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.keybindings.version, 1);
  assert.equal(envelope.keybindings.overrides.length, 2);
});

// ---------------------------------------------------------------------------
// 23. save() sanitizes entries with empty action/keybinding
// ---------------------------------------------------------------------------

test("keybinding: save() sanitizes entries with empty fields", () => {
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  bridge.save([
    { action: "", keybinding: "ctrl+h" },
    { action: "shell.focus.left", keybinding: "" },
    { action: "shell.focus.right", keybinding: "ctrl+l" },
  ]);

  const saved = configService._store[KEYBINDING_CONFIG_KEY];
  assert.equal(saved.length, 1);
  assert.equal(saved[0].action, "shell.focus.right");
});

// ---------------------------------------------------------------------------
// 24. Non-destructive — original localStorage data preserved
// ---------------------------------------------------------------------------

test("keybinding: migrate() preserves original localStorage data after migration", () => {
  const storageKey = storageKeyForUser(USER_ID);
  const originalEnvelope = makeKeybindingEnvelope(CUSTOM_KEYBINDINGS);
  const storage = createStubStorage({
    [storageKey]: originalEnvelope,
  });
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage,
    userId: USER_ID,
  });

  bridge.migrate();

  // Original localStorage data must still be intact
  assert.equal(storage.getItem(storageKey), originalEnvelope);
});

// ---------------------------------------------------------------------------
// 25. load() — returns empty when both sources are empty
// ---------------------------------------------------------------------------

test("keybinding: load() returns empty array when both sources are empty", () => {
  const configService = createStubConfigService();

  const bridge = createKeybindingConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
  });

  const result = bridge.load();
  assert.equal(result.length, 0);
});

// ---------------------------------------------------------------------------
// 26. Custom config key
// ---------------------------------------------------------------------------

test("keybinding: supports custom configKey", () => {
  const customKey = "custom.keybinding.key";
  const configService = createStubConfigService({
    [customKey]: CUSTOM_KEYBINDINGS,
  });

  const bridge = createKeybindingConfigBridge({
    configService,
    storage: createStubStorage(),
    userId: USER_ID,
    configKey: customKey,
  });

  const result = bridge.load();
  assert.equal(result.length, 2);
  assert.equal(result[0].action, "shell.focus.left");
});
