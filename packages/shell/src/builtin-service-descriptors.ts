// builtin-service-descriptors.ts — Declarative registration of all builtin services.
//
// Replaces 9 individual registration calls in bootstrap.ts with a single
// `registerBuiltinServices()` invocation driven by a descriptor array.

import type { ConfigurationService } from "@ghost-shell/contracts";
import { registerActivityStatusServiceCapability } from "./activity-status-service-registration.js";
import { registerConfigurationServiceCapability } from "./config-service-registration.js";
import type { ContextServiceDeps } from "./context-service-registration.js";
import { registerContextServiceCapability } from "./context-service-registration.js";
import { registerHookRegistryCapability } from "./hook-registry-registration.js";
import { registerLayoutModeServiceCapability } from "./services/layout-mode-service-registration.js";
import type { KeybindingServiceDeps } from "./keybinding-service-registration.js";
import { registerKeybindingServiceCapability } from "./keybinding-service-registration.js";
import { registerPluginManagementServiceCapability } from "./plugin-management-service-registration.js";
import { registerPluginRegistryServiceCapability } from "./plugin-registry-service-registration.js";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import type { SyncStatusServiceDeps } from "./sync-status-service-registration.js";
import { registerSyncStatusServiceCapability } from "./sync-status-service-registration.js";
import type { ThemeRegistry } from "./theme-registry.js";
import { registerThemeServiceCapability } from "./theme-service-registration.js";

/**
 * Dependencies needed by the builtin service registration phase.
 * Mirrors the relevant fields from ShellBootstrapOptions plus
 * runtime state created during bootstrap (e.g. themeRegistry).
 */
export interface BuiltinServiceDeps {
  readonly registry: ShellPluginRegistry;
  readonly themeRegistry: ThemeRegistry;
  readonly configurationService?: ConfigurationService | undefined;
  readonly syncStatusDeps?: SyncStatusServiceDeps | undefined;
  readonly contextServiceDeps?: ContextServiceDeps | undefined;
  readonly keybindingServiceDeps?: KeybindingServiceDeps | undefined;
}

/** Registration phase — controls ordering relative to plugin activation. */
export type BuiltinServicePhase = "pre-activation" | "post-activation";

/**
 * A declarative descriptor for a builtin service registration.
 *
 * Each entry describes one builtin service: its identity, the phase
 * in which it should be registered, and a `register` callback that
 * performs the actual registration (delegating to the existing
 * per-service registration modules).
 */
export interface BuiltinServiceDescriptor {
  readonly serviceId: string;
  readonly pluginId: string;
  readonly phase: BuiltinServicePhase;
  /** Return `false` to skip registration (e.g. when optional deps are missing). */
  readonly register: (deps: BuiltinServiceDeps) => void | false;
}

/**
 * All 9 builtin services in registration order.
 *
 * The order within a phase matches the original bootstrap.ts sequence
 * to preserve identical runtime behavior.
 */
export const BUILTIN_SERVICES: readonly BuiltinServiceDescriptor[] = [
  {
    serviceId: "ghost.config.Service",
    pluginId: "ghost.shell.config-service",
    phase: "pre-activation",
    register(deps) {
      if (!deps.configurationService) return false;
      registerConfigurationServiceCapability(deps.registry, deps.configurationService);
    },
  },
  {
    serviceId: "ghost.theme.Service",
    pluginId: "ghost.shell.theme-service",
    phase: "pre-activation",
    register(deps) {
      registerThemeServiceCapability(deps.registry, deps.themeRegistry);
    },
  },
  {
    serviceId: "ghost.plugin-registry.Service",
    pluginId: "ghost.shell.plugin-registry-service",
    phase: "pre-activation",
    register(deps) {
      registerPluginRegistryServiceCapability(deps.registry, {
        registry: deps.registry,
        getPluginNotice: () => "",
      });
    },
  },
  {
    serviceId: "ghost.plugin-management.Service",
    pluginId: "ghost.shell.plugin-management-service",
    phase: "pre-activation",
    register(deps) {
      registerPluginManagementServiceCapability(deps.registry);
    },
  },
  {
    serviceId: "ghost.activity-status.Service",
    pluginId: "ghost.shell.activity-status-service",
    phase: "pre-activation",
    register(deps) {
      registerActivityStatusServiceCapability(deps.registry);
    },
  },
  {
    serviceId: "ghost.sync-status.Service",
    pluginId: "ghost.shell.sync-status-service",
    phase: "pre-activation",
    register(deps) {
      if (!deps.syncStatusDeps) return false;
      registerSyncStatusServiceCapability(deps.registry, deps.syncStatusDeps);
    },
  },
  {
    serviceId: "ghost.context.Service",
    pluginId: "ghost.shell.context-service",
    phase: "pre-activation",
    register(deps) {
      if (!deps.contextServiceDeps) return false;
      registerContextServiceCapability(deps.registry, deps.contextServiceDeps);
    },
  },
  {
    serviceId: "ghost.keybinding.Service",
    pluginId: "ghost.shell.keybinding-service",
    phase: "pre-activation",
    register(deps) {
      if (!deps.keybindingServiceDeps) return false;
      registerKeybindingServiceCapability(deps.registry, deps.keybindingServiceDeps);
    },
  },
  {
    serviceId: "ghost.hook-registry.Service",
    pluginId: "ghost.shell.hook-registry",
    phase: "pre-activation",
    register(deps) {
      registerHookRegistryCapability(deps.registry);
    },
  },
  {
    serviceId: "ghost.layout",
    pluginId: "ghost.shell.layout-service",
    phase: "pre-activation",
    register(deps) {
      registerLayoutModeServiceCapability(deps.registry);
    },
  },
];

/**
 * Register all builtin services for the given phase.
 * When `phase` is omitted, registers all services regardless of phase.
 */
export function registerBuiltinServices(deps: BuiltinServiceDeps, phase?: BuiltinServicePhase): void {
  for (const descriptor of BUILTIN_SERVICES) {
    if (phase !== undefined && descriptor.phase !== phase) continue;
    descriptor.register(deps);
  }
}
