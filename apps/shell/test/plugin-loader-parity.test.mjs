import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeFirstPluginLoader, PluginLoadError } from "../../../packages/shell/src/plugin-loader.js";

function createDescriptor(mode) {
  return {
    id: `ghost.parity.${mode}`,
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

test("remote invalid contracts report INVALID_CONTRACT diagnostics", async () => {
  const remoteDiagnostics = [];

  const remoteLoader = createRuntimeFirstPluginLoader({
    federationRuntime: {
      registerRemote() {
        // no-op in test
      },
      async loadPluginContract() {
        return invalidContract;
      },
    },
    onDiagnostic(diagnostic) {
      remoteDiagnostics.push(diagnostic);
    },
  });

  await assert.rejects(
    () => remoteLoader.loadPluginContract(createDescriptor("remote-manifest")),
    (error) => {
      assert.ok(error instanceof PluginLoadError);
      assert.equal(error.context.reason, "INVALID_CONTRACT");
      assert.equal(error.context.strategy, "remote-manifest");
      assert.equal(error.context.attempts, 3);
      assert.equal(error.context.maxAttempts, 3);
      assert.match(error.context.message, /^Remote plugin '.+' returned invalid contract:/);
      return true;
    },
  );

  assert.equal(remoteDiagnostics.length, 1);
  assert.equal(remoteDiagnostics[0]?.code, "INVALID_CONTRACT");
  assert.equal(remoteDiagnostics[0]?.level, "warn");
  assert.match(remoteDiagnostics[0]?.message ?? "", /^Remote plugin '.+' returned invalid contract:/);
});

test("remote contracts wrapped as default export modules are unwrapped before validation", async () => {
  const remoteLoader = createRuntimeFirstPluginLoader({
    federationRuntime: {
      registerRemote() {
        // no-op in test
      },
      async loadPluginContract() {
        return {
          default: {
            manifest: {
              id: "ghost.parity.wrapped-contract",
              name: "Wrapped Contract",
              version: "0.1.0",
            },
          },
        };
      },
    },
  });

  const contract = await remoteLoader.loadPluginContract(createDescriptor("remote-manifest"));
  assert.equal(contract.contract.manifest.id, "ghost.parity.wrapped-contract");
});
