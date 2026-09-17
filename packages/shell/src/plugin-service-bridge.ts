import type { PluginServices } from "@ghost-shell/contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import { createPluginServiceAccessor } from "./plugin-service-accessor.js";

export function createPluginServicesBridge(registry: ShellPluginRegistry): PluginServices {
  return {
    getService: createPluginServiceAccessor(<T = unknown>(id: string) => registry.getService<T>(id)),
    hasService(id: string): boolean {
      return registry.hasService(id);
    },
  };
}
