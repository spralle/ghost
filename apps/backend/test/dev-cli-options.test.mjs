import assert from "node:assert/strict";
import test from "node:test";

import { formatLocalPluginOverrideStartupSummary, parseBackendDevCliOptions } from "../src/dev-cli-options.js";
import {
  buildEntryOverrideMap,
  DEFAULT_LOCAL_PLUGIN_ENTRIES,
  LOCAL_PLUGIN_IDS,
} from "./fixtures/local-plugin-overrides-fixtures.mjs";

test("parseBackendDevCliOptions keeps no-override baseline when no flags are provided", () => {
  const parsed = parseBackendDevCliOptions([]);

  assert.deepEqual(parsed, {
    selectedLocalPluginIds: [],
    duplicateSelectedLocalPluginIds: [],
    gatewayPort: undefined,
    pluginDirs: [],
  });
});

test("parseBackendDevCliOptions supports repeated --local-plugin values", () => {
  const parsed = parseBackendDevCliOptions([
    "--local-plugin",
    LOCAL_PLUGIN_IDS.pluginStarter,
    "--local-plugin",
    LOCAL_PLUGIN_IDS.sampleContractConsumer,
  ]);

  assert.deepEqual(parsed.selectedLocalPluginIds, [
    LOCAL_PLUGIN_IDS.pluginStarter,
    LOCAL_PLUGIN_IDS.sampleContractConsumer,
  ]);
});

test("parseBackendDevCliOptions normalizes duplicate and whitespace plugin IDs deterministically", () => {
  const parsed = parseBackendDevCliOptions([
    "--local-plugin",
    ` ${LOCAL_PLUGIN_IDS.sampleContractConsumer} `,
    "--local-plugin",
    LOCAL_PLUGIN_IDS.pluginStarter,
    "--local-plugin",
    LOCAL_PLUGIN_IDS.pluginStarter,
  ]);

  assert.deepEqual(parsed.selectedLocalPluginIds, [
    LOCAL_PLUGIN_IDS.pluginStarter,
    LOCAL_PLUGIN_IDS.sampleContractConsumer,
  ]);
  assert.deepEqual(parsed.duplicateSelectedLocalPluginIds, [LOCAL_PLUGIN_IDS.pluginStarter]);
});

test("parseBackendDevCliOptions rejects invalid plugin ID format with actionable error", () => {
  assert.throws(
    () => parseBackendDevCliOptions(["--local-plugin", "Ghost.Invalid"]),
    /Invalid local plugin id 'Ghost\.Invalid' from --local-plugin argument\./,
  );
});

test("parseBackendDevCliOptions rejects unknown plugin IDs with actionable error", () => {
  assert.throws(
    () => parseBackendDevCliOptions(["--local-plugin", "ghost.unknown.plugin"]),
    /Unknown local plugin id\(s\): ghost\.unknown\.plugin\..*Available local plugin id\(s\): .*Use --local-plugin <pluginId> with one of the available IDs\./,
  );
});

test("parseBackendDevCliOptions fails fast on missing --local-plugin value", () => {
  assert.throws(
    () => parseBackendDevCliOptions(["--local-plugin"]),
    /Missing value for --local-plugin\. Use --local-plugin <pluginId>\./,
  );
});

test("formatLocalPluginOverrideStartupSummary reports none selected", () => {
  assert.equal(
    formatLocalPluginOverrideStartupSummary([], new Map()),
    "[backend] local plugin overrides: none selected",
  );
});

test("formatLocalPluginOverrideStartupSummary prints deterministic selected overrides", () => {
  const summary = formatLocalPluginOverrideStartupSummary(
    [LOCAL_PLUGIN_IDS.sampleContractConsumer, LOCAL_PLUGIN_IDS.pluginStarter],
    buildEntryOverrideMap(DEFAULT_LOCAL_PLUGIN_ENTRIES),
  );

  assert.equal(
    summary,
    `[backend] local plugin overrides (2): ghost.plugin-starter -> ${DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.pluginStarter]}; ghost.sample.contract-consumer -> ${DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.sampleContractConsumer]}`,
  );
});

test("formatLocalPluginOverrideStartupSummary fails fast for missing selected mapping", () => {
  assert.throws(
    () => formatLocalPluginOverrideStartupSummary(["ghost.plugin-starter"], new Map()),
    /Missing local plugin override entry mapping for selected plugin 'ghost\.plugin-starter'/,
  );
});

test("parseBackendDevCliOptions parses --gateway-port as positive integer", () => {
  const parsed = parseBackendDevCliOptions(["--gateway-port", "41337"]);

  assert.equal(parsed.gatewayPort, 41337);
  assert.deepEqual(parsed.selectedLocalPluginIds, []);
});

test("parseBackendDevCliOptions returns undefined gatewayPort when flag is absent", () => {
  const parsed = parseBackendDevCliOptions([]);

  assert.equal(parsed.gatewayPort, undefined);
});

test("parseBackendDevCliOptions combines --gateway-port with --local-plugin", () => {
  const parsed = parseBackendDevCliOptions(["--gateway-port", "9999", "--local-plugin", LOCAL_PLUGIN_IDS.themeDefault]);

  assert.equal(parsed.gatewayPort, 9999);
  assert.deepEqual(parsed.selectedLocalPluginIds, [LOCAL_PLUGIN_IDS.themeDefault]);
});

test("parseBackendDevCliOptions rejects missing --gateway-port value", () => {
  assert.throws(
    () => parseBackendDevCliOptions(["--gateway-port"]),
    /Missing value for --gateway-port\. Use --gateway-port <number>\./,
  );
});

test("parseBackendDevCliOptions rejects non-numeric --gateway-port value", () => {
  assert.throws(
    () => parseBackendDevCliOptions(["--gateway-port", "abc"]),
    /Invalid value 'abc' for --gateway-port\. Expected a positive integer\./,
  );
});
