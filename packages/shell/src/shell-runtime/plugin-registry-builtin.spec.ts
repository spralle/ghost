import { describe, expect, it } from "vitest";
import type { PluginContract } from "@ghost-shell/contracts";
import { createShellPluginRegistry } from "../plugin-registry.js";

function createTestBuiltinContract(): PluginContract {
  return {
    manifest: {
      id: "com.test.builtin",
      name: "Test Builtin",
      version: "1.0.0",
    },
    contributes: {
      actions: [{ id: "test.action.one", title: "Test Action", intent: "test.intent" }],
      keybindings: [{ action: "test.action.one", keybinding: "ctrl+shift+t" }],
    },
  };
}

describe("plugin registry builtin", () => {
  it("registerBuiltinPlugin makes plugin activatable by command", async () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);
    registry.registerBuiltinPlugin(createTestBuiltinContract());

    const activated = await registry.activateByAction("com.test.builtin", "test.action.one");
    expect(activated).toBe(true);
  });

  it("builtin plugin survives registerManifestDescriptors clear", async () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);
    registry.registerBuiltinPlugin(createTestBuiltinContract());

    // Simulate tenant hydration — this calls states.clear() internally
    registry.registerManifestDescriptors("demo-tenant", []);

    const activated = await registry.activateByAction("com.test.builtin", "test.action.one");
    expect(activated).toBe(true);
  });

  it("builtin plugin appears in registry snapshot", () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);
    registry.registerBuiltinPlugin(createTestBuiltinContract());

    const snapshot = registry.getSnapshot();
    const builtinPlugin = snapshot.plugins.find((p) => p.id === "com.test.builtin");
    expect(builtinPlugin).toBeTruthy();
    expect(builtinPlugin?.enabled).toBe(true);
    expect(builtinPlugin?.lifecycle.state).toBe("active");
    expect(builtinPlugin?.contract).toBeTruthy();
  });

  it("unregistered plugin is not activatable", async () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);

    const activated = await registry.activateByAction("com.nonexistent.plugin", "some.action");
    expect(activated).toBe(false);
  });
});
