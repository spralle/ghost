import assert from "node:assert/strict";
import test from "node:test";
import { createShellPluginRegistry } from "../../../packages/shell/src/plugin-registry.js";

function createDescriptor(id) {
  return {
    id,
    version: "0.1.0",
    entry: "https://example.com/mf-manifest.json",
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
  };
}

const invalidContract = {
  manifest: {
    id: "",
    name: "Broken",
  },
};

test("registry maps remote invalid contracts to INVALID_CONTRACT", async () => {
  const registry = createShellPluginRegistry({
    pluginLoader: {
      name: "remote-manifest",
      async loadPluginContract(descriptor) {
        const { createRuntimeFirstPluginLoader } = await import("../../../packages/shell/src/plugin-loader.js");
        const loader = createRuntimeFirstPluginLoader({
          federationRuntime: {
            registerRemote() {
              // no-op
            },
            async loadPluginContract() {
              return invalidContract;
            },
          },
        });
        return loader.loadPluginContract(descriptor);
      },
    },
  });

  const remoteDescriptor = createDescriptor("ghost.remote");
  registry.registerManifestDescriptors("demo", [remoteDescriptor]);

  await registry.setEnabled(remoteDescriptor.id, true);
  await registry.activateByView(remoteDescriptor.id, "test.view");

  const snapshot = registry.getSnapshot();
  const remoteState = snapshot.plugins.find((plugin) => plugin.id === remoteDescriptor.id);
  assert.ok(remoteState);
  assert.equal(remoteState.failure?.code, "INVALID_CONTRACT");

  const invalidDiagnostics = snapshot.diagnostics.filter((diag) => diag.code === "INVALID_CONTRACT");
  assert.equal(invalidDiagnostics.length >= 1, true);
});
