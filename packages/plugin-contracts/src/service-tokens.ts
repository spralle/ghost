import { createServiceToken } from "./service-token.js";
import type { ThemeService } from "./theme-service.js";
import type { WorkspaceService } from "./workspace-service.js";
import type { KeybindingService } from "./keybinding-service.js";
import type { ContextService } from "./context-service.js";
import type { ActivityStatusService } from "./activity-status-service.js";
import type { SyncStatusService } from "./sync-status-service.js";
import type { ConfigurationService } from "./config-service.js";
import type { PluginManagementService } from "./plugin-management-service.js";
import type { PluginRegistryService } from "./plugin-registry-service.js";
import type { ActionService, WindowService, ViewService, MenuService } from "./ghost-api.js";

// ---------------------------------------------------------------------------
// Service Tokens — typed tokens for all builtin services
// ---------------------------------------------------------------------------

/** Token for theme management service. */
export const Theme = createServiceToken<ThemeService>("ghost.theme");

/** Token for action registration and execution. */
export const Action = createServiceToken<ActionService>("ghost.action");

/** Token for window management and UI primitives. */
export const Window = createServiceToken<WindowService>("ghost.window");

/** Token for view discovery and opening. */
export const View = createServiceToken<ViewService>("ghost.view");

/** Token for menu contribution resolution and dispatch. */
export const Menu = createServiceToken<MenuService>("ghost.menu");

/** Token for workspace management. */
export const Workspace = createServiceToken<WorkspaceService>("ghost.workspace");

/** Token for keybinding management. */
export const Keybinding = createServiceToken<KeybindingService>("ghost.keybinding");

/** Token for context/selection state. */
export const Context = createServiceToken<ContextService>("ghost.context");

/** Token for activity status tracking. */
export const ActivityStatus = createServiceToken<ActivityStatusService>("ghost.activityStatus");

/** Token for cross-window sync status. */
export const SyncStatus = createServiceToken<SyncStatusService>("ghost.syncStatus");

/** Token for configuration service. */
export const Configuration = createServiceToken<ConfigurationService>("ghost.configuration");

/** Token for plugin management (enable/disable/activate). */
export const PluginManagement = createServiceToken<PluginManagementService>("ghost.pluginManagement");

/** Token for plugin registry inspection. */
export const PluginRegistry = createServiceToken<PluginRegistryService>("ghost.pluginRegistry");
