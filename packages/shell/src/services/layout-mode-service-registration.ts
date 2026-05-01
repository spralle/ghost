// layout-mode-service-registration.ts — Registers the LayoutModeService as a builtin plugin.

import type { PluginContract } from "@ghost-shell/contracts";
import { LAYOUT_SERVICE_ID } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "../plugin-registry-types.js";
import { createLayoutModeService } from "./layout-mode-service.js";
import type { DisposableLayoutModeService } from "./layout-mode-types.js";

export const LAYOUT_SERVICE_PLUGIN_ID = "ghost.shell.layout-service";

/** Shared reference so other shell code can access the service instance. */
let activeService: DisposableLayoutModeService | null = null;

export function getLayoutModeService(): DisposableLayoutModeService | null {
  return activeService;
}

/**
 * Create a LayoutModeService and register it as a builtin plugin
 * capability on the plugin registry.
 */
export function registerLayoutModeServiceCapability(registry: ShellPluginRegistry): void {
  const service = createLayoutModeService();
  if (activeService) {
    activeService.dispose();
  }
  activeService = service;

  const contract: PluginContract = {
    manifest: {
      id: LAYOUT_SERVICE_PLUGIN_ID,
      name: "Layout Mode Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [{ id: LAYOUT_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [LAYOUT_SERVICE_ID]: service });
}
