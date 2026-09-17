import assert from "node:assert/strict";
import test from "node:test";
import { createShellPluginRegistry } from "../../../packages/shell/src/plugin-registry.js";

function descriptor(id) {
  return {
    id,
    version: "1.0.0",
    entry: "https://example.com/mf-manifest.json",
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
  };
}

function providerContract() {
  return {
    manifest: {
      id: "ghost.provider",
      name: "Provider",
      version: "1.2.0",
    },
    contributes: {
      capabilities: {
        components: [{ id: "ghost.component.map", version: "1.2.0" }],
        services: [{ id: "ghost.service.route", version: "2.0.1" }],
      },
    },
  };
}

function consumerContract() {
  return {
    manifest: {
      id: "ghost.consumer",
      name: "Consumer",
      version: "1.0.0",
    },
    dependsOn: {
      plugins: [{ pluginId: "ghost.provider", versionRange: "^1.0.0" }],
      components: [{ id: "ghost.component.map", versionRange: "^1.0.0" }],
      services: [{ id: "ghost.service.route", versionRange: "^2.0.0" }],
    },
  };
}

test("activation fails with actionable dependency diagnostics and no auto-enable", async () => {
  const registry = createShellPluginRegistry({
    pluginLoader: {
      name: "remote-manifest",
      async loadPluginContract(target) {
        const contract = target.id === "ghost.provider" ? providerContract() : consumerContract();
        return { contract, activate: null };
      },
      async loadPluginComponents() {
        return {
          "ghost.component.map": { component: "MapComponent" },
        };
      },
      async loadPluginServices() {
        return {
          "ghost.service.route": { service: "RouteService" },
        };
      },
    },
  });

  registry.registerManifestDescriptors("demo", [descriptor("ghost.consumer"), descriptor("ghost.provider")]);

  await registry.setEnabled("ghost.consumer", true);
  const activated = await registry.activateByView("ghost.consumer", "view.main");
  assert.equal(activated, false);

  const snapshot = registry.getSnapshot();
  const consumer = snapshot.plugins.find((plugin) => plugin.id === "ghost.consumer");
  const provider = snapshot.plugins.find((plugin) => plugin.id === "ghost.provider");

  assert.ok(consumer);
  assert.ok(provider);
  assert.equal(consumer.lifecycle.state, "failed");
  assert.equal(consumer.failure?.code, "MISSING_DEPENDENCY_PLUGIN");
  assert.equal(provider.lifecycle.state, "disabled");

  const dependencyCodes = snapshot.diagnostics
    .map((diagnostic) => diagnostic.code)
    .filter((code) => code.startsWith("MISSING_DEPENDENCY_"));
  assert.equal(dependencyCodes.includes("MISSING_DEPENDENCY_PLUGIN"), true);
  assert.equal(dependencyCodes.includes("MISSING_DEPENDENCY_COMPONENT"), true);
  assert.equal(dependencyCodes.includes("MISSING_DEPENDENCY_SERVICE"), true);
});

test("resolves component/service capabilities from split plugin modules", async () => {
  const providerComponent = { component: "MapComponent" };
  const providerService = { service: "RouteService" };

  const registry = createShellPluginRegistry({
    pluginLoader: {
      name: "remote-manifest",
      async loadPluginContract(target) {
        const contract = target.id === "ghost.provider" ? providerContract() : consumerContract();
        return { contract, activate: null };
      },
      async loadPluginComponents() {
        return {
          "ghost.component.map": providerComponent,
        };
      },
      async loadPluginServices() {
        return {
          "ghost.service.route": providerService,
        };
      },
    },
  });

  registry.registerManifestDescriptors("demo", [descriptor("ghost.consumer"), descriptor("ghost.provider")]);

  await registry.setEnabled("ghost.provider", true);
  await registry.setEnabled("ghost.consumer", true);

  assert.equal(await registry.activateByView("ghost.provider", "view.provider"), true);
  assert.equal(await registry.activateByView("ghost.consumer", "view.consumer"), true);

  const resolvedComponent = await registry.resolveComponentCapability("ghost.consumer", "ghost.component.map");
  const resolvedService = await registry.resolveServiceCapability("ghost.consumer", "ghost.service.route");

  assert.equal(resolvedComponent, providerComponent);
  assert.equal(resolvedService, providerService);
});
