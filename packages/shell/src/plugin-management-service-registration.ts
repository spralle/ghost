// plugin-management-service-registration.ts — PluginManagementService adapter and shell registration.

import type { PluginContract, PluginManagementService } from "@ghost-shell/contracts";
import { PLUGIN_MANAGEMENT_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const PLUGIN_MANAGEMENT_SERVICE_PLUGIN_ID = "ghost.shell.plugin-management-service";

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerPluginManagementServiceCapability(registry: ShellPluginRegistry): void {
  const service: PluginManagementService = {
    togglePlugin(pluginId: string, enabled: boolean): void {
      void registry.setEnabled(pluginId, enabled);
    },

    activatePlugin(pluginId: string): Promise<boolean> {
      return registry.activateByEvent(pluginId, "onStartup");
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: PLUGIN_MANAGEMENT_SERVICE_PLUGIN_ID,
      name: "Plugin Management Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [{ id: PLUGIN_MANAGEMENT_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [PLUGIN_MANAGEMENT_SERVICE_ID]: service }, undefined, {
    [PLUGIN_MANAGEMENT_SERVICE_ID]: { lazy: true },
  });
}
