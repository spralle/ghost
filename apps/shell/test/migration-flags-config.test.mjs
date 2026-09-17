import assert from "node:assert/strict";
import test from "node:test";
import {
  readShellMigrationFlags,
  selectCrossWindowDnd,
  selectShellTransportPath,
} from "../../../packages/shell/src/app/migration-flags.ts";

const expectedKeys = [
  "enableAsyncScompAdapter",
  "enableCrossWindowDnd",
  "forceDisableCrossWindowDnd",
  "forceLegacyBridge",
];

function readFlags(overrides = {}) {
  return readShellMigrationFlags(new URLSearchParams(), overrides);
}

test("migration flags expose every supported key", () => {
  assert.deepEqual(Object.keys(readFlags()).sort(), expectedKeys);
});

test("all migration flag defaults are booleans", () => {
  assert.equal(
    Object.values(readFlags()).every((value) => typeof value === "boolean"),
    true,
  );
});

test("migration flags retain documented defaults", () => {
  assert.deepEqual(readFlags(), {
    enableAsyncScompAdapter: false,
    forceLegacyBridge: false,
    enableCrossWindowDnd: true,
    forceDisableCrossWindowDnd: false,
  });
});

test("migration flags accept runtime overrides", () => {
  assert.deepEqual(readFlags({ enableAsyncScompAdapter: true, forceLegacyBridge: true, enableCrossWindowDnd: false }), {
    enableAsyncScompAdapter: true,
    forceLegacyBridge: true,
    enableCrossWindowDnd: false,
    forceDisableCrossWindowDnd: false,
  });
});

test("runtime overrides produce the same output shape as defaults", () => {
  assert.deepEqual(Object.keys(readFlags({ forceLegacyBridge: true })).sort(), Object.keys(readFlags()).sort());
});

test("query and runtime overrides agree for a non-default scenario", () => {
  const query = readShellMigrationFlags(
    new URLSearchParams("shellAsyncScompAdapter=true&shellLegacyBridgeKillSwitch=1"),
    null,
  );
  assert.deepEqual(readFlags({ enableAsyncScompAdapter: true, forceLegacyBridge: true }), query);
});

test("default flags select legacy bridge", () => {
  assert.deepEqual(selectShellTransportPath(readFlags()), { path: "legacy-bridge", reason: "default-legacy" });
});

test("async adapter override selects async transport", () => {
  assert.deepEqual(selectShellTransportPath(readFlags({ enableAsyncScompAdapter: true })), {
    path: "async-scomp-adapter",
    reason: "async-flag-enabled",
  });
});

test("legacy kill switch takes priority over async transport", () => {
  assert.deepEqual(selectShellTransportPath(readFlags({ enableAsyncScompAdapter: true, forceLegacyBridge: true })), {
    path: "legacy-bridge",
    reason: "kill-switch-force-legacy",
  });
});

test("default flags enable cross-window DnD", () => {
  assert.deepEqual(selectCrossWindowDnd(readFlags()), {
    enabled: true,
    path: "cross-window-bridge",
    reason: "flag-enabled",
  });
});

test("cross-window kill switch forces same-window DnD", () => {
  assert.deepEqual(selectCrossWindowDnd(readFlags({ forceDisableCrossWindowDnd: true })), {
    enabled: false,
    path: "same-window",
    reason: "kill-switch-force-disabled",
  });
});

test("disabled cross-window flag selects same-window default", () => {
  assert.deepEqual(selectCrossWindowDnd(readFlags({ enableCrossWindowDnd: false })), {
    enabled: false,
    path: "same-window",
    reason: "default-same-window-only",
  });
});

test("query parsing retains false defaults for unknown values", () => {
  const flags = readShellMigrationFlags(
    new URLSearchParams("shellAsyncScompAdapter=invalid&shellLegacyBridgeKillSwitch=invalid"),
    null,
  );
  assert.equal(flags.enableAsyncScompAdapter, false);
  assert.equal(flags.forceLegacyBridge, false);
});
