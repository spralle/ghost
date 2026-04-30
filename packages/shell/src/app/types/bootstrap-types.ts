import type { ConfigurationService, PluginContract } from "@ghost-shell/contracts";
import type { LayerRegistry } from "@ghost-shell/layer";
import type { ContextServiceDeps } from "../../context-service-registration.js";
import type { KeybindingServiceDeps } from "../../keybinding-service-registration.js";
import type { GhostApiFactoryDependencies } from "../../plugin-api/ghost-api-factory.js";
import type { PluginConfigSyncConfigurationService } from "../../plugin-config-sync-controller.js";
import type { ShellPluginRegistry } from "../../plugin-registry.js";
import type { SyncStatusServiceDeps } from "../../sync-status-service-registration.js";
import type { ThemeRegistry } from "../../theme-registry.js";

export type { ConfigurationService } from "@ghost-shell/contracts";

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
  registry: ShellPluginRegistry;
  layerRegistry: LayerRegistry;
  themeRegistry?: ThemeRegistry | undefined;
  disposePluginConfigSync: (() => void) | null;
}

export interface ShellBootstrapOptions {
  tenantId: string;
  fetchManifest?: (manifestUrl: string) => Promise<unknown>;
  enableByDefault?: boolean;
  defaultThemeId?: string | undefined;
  configurationService?: (ConfigurationService & PluginConfigSyncConfigurationService) | undefined;
  /** Called after manifest registration and after each plugin activation completes. */
  onProgress?: (registry: ShellPluginRegistry) => void;
  /** Dependencies for constructing GhostApi instances during plugin activation. */
  apiDeps?: GhostApiFactoryDependencies | undefined;
  /** Dependencies for SyncStatusService — registered before plugin activation. */
  syncStatusDeps?: SyncStatusServiceDeps | undefined;
  /** Dependencies for ContextService — registered before plugin activation. */
  contextServiceDeps?: ContextServiceDeps | undefined;
  /** Dependencies for KeybindingService — registered before plugin activation. */
  keybindingServiceDeps?: KeybindingServiceDeps | undefined;
  /** Pre-created LayerRegistry for wiring layer contributions during plugin activation. */
  layerRegistry?: LayerRegistry | undefined;
}
