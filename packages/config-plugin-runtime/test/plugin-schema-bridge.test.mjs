import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composePluginSchemas, createPluginConfigCatalog, extractPluginSchemas } from "../src/index.ts";

function plugin(pluginId, property = "mode") {
  return {
    pluginId,
    configuration: {
      type: "object",
      properties: { [property]: { type: "string", default: "standard" } },
    },
  };
}

describe("plugin-schema-bridge", () => {
  it("collects schema from a single plugin with config", () => {
    const declarations = extractPluginSchemas([plugin("@ghost-shell/theme-service")]);

    assert.equal(declarations.length, 1);
    assert.equal(declarations[0]?.namespace, "ghostShell.themeService");
    assert.equal(declarations[0]?.properties.mode.default, "standard");
  });

  it("collects schemas from multiple plugins", () => {
    const declarations = extractPluginSchemas([
      plugin("@ghost-shell/theme-service"),
      plugin("@ghost-shell/editor-core", "fontSize"),
    ]);

    assert.deepEqual(
      declarations.map((declaration) => declaration.ownerId),
      ["@ghost-shell/theme-service", "@ghost-shell/editor-core"],
    );
  });

  it("skips plugins without configuration", () => {
    assert.deepEqual(extractPluginSchemas([{ pluginId: "no-config" }]), []);
  });

  it("skips plugins with explicit undefined configuration", () => {
    assert.deepEqual(extractPluginSchemas([{ pluginId: "no-config", configuration: undefined }]), []);
  });

  it("buildSchemaMap composes single plugin", () => {
    const result = composePluginSchemas([plugin("@ghost-shell/theme-service")]);

    assert.deepEqual(result.errors, []);
    assert.equal(result.schemas.get("ghostShell.themeService.mode")?.ownerId, "@ghost-shell/theme-service");
  });

  it("buildSchemaMap detects duplicate keys across plugins", () => {
    const result = composePluginSchemas([plugin("@ghost-shell/theme-service"), plugin("ghost-shell.theme-service")]);

    assert.equal(result.errors[0]?.type, "duplicate-key");
    assert.deepEqual(result.errors[0]?.ownerIds, ["@ghost-shell/theme-service", "ghost-shell.theme-service"]);
  });

  it("buildSchemaMap returns empty for plugins without config", () => {
    const result = composePluginSchemas([{ pluginId: "no-config" }]);

    assert.equal(result.schemas.size, 0);
    assert.deepEqual(result.errors, []);
  });

  it("incremental registry registers and unregisters plugin schema", () => {
    const catalog = createPluginConfigCatalog();
    const registered = catalog.registerPlugin(plugin("@ghost-shell/theme-service"));

    assert.deepEqual(registered.registeredKeys, ["ghostShell.themeService.mode"]);
    assert.equal(catalog.getSchemasByOwner("@ghost-shell/theme-service").size, 1);
    assert.deepEqual(catalog.unregisterPlugin("@ghost-shell/theme-service").removedKeys, [
      "ghostShell.themeService.mode",
    ]);
    assert.equal(catalog.getSchemas().size, 0);
  });

  it("incremental registry reports duplicate-key collisions", () => {
    const catalog = createPluginConfigCatalog();
    catalog.registerPlugin(plugin("@ghost-shell/theme-service"));

    const collision = catalog.registerPlugin(plugin("ghost-shell.theme-service"));

    assert.equal(collision.errors[0]?.type, "duplicate-key");
    assert.deepEqual(collision.registeredKeys, []);
    assert.equal(catalog.getSchemas().size, 1);
    assert.equal(catalog.getSchema("ghostShell.themeService.mode")?.ownerId, "@ghost-shell/theme-service");
  });
});
