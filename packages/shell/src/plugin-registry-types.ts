import type { DeactivationContext, Disposable, PluginContract, TenantPluginDescriptor } from "@ghost-shell/contracts";
import type { CompatibilityReasonCode } from "@ghost-shell/plugin-system";
import type { CapabilityDependencyFailureCode } from "./capability-registry.js";
import type { GhostApiInstance } from "./plugin-api/ghost-api-factory.js";
import type { PluginActivateFunction, PluginLoadStrategy } from "./plugin-loader.js";

/** The deactivate() function signature optionally exported by a plugin module. */
export type PluginDeactivateFunction = (context: DeactivationContext) => void | Promise<void>;

export interface PluginRuntimeFailure {
  code:
    | CompatibilityReasonCode
    | "REMOTE_UNAVAILABLE"
    | "INVALID_CONTRACT"
    | "COMPONENTS_UNAVAILABLE"
    | "SERVICES_UNAVAILABLE"
    | CapabilityDependencyFailureCode
    | "COMPONENT_EXPORT_MISSING"
    | "SERVICE_EXPORT_MISSING"
    | "LOCAL_SOURCE_UNAVAILABLE"
    | "UNKNOWN_PLUGIN_LOAD_ERROR"
    | "ACTIVATE_FAILED";
  message: string;
  retryable: boolean;
}

export type PluginActivationTriggerType = "action" | "view" | "intent" | "event";

export type PluginLifecycleState = "disabled" | "registered" | "activating" | "active" | "failed";

export interface PluginActivationTrigger {
  type: PluginActivationTriggerType;
  id: string;
}

export interface PluginLifecycleSnapshot {
  state: PluginLifecycleState;
  lastTransitionAt: string;
  lastTrigger: PluginActivationTrigger | null;
}

export interface PluginRuntimeState {
  descriptor: TenantPluginDescriptor;
  enabled: boolean;
  loadStrategy: string;
  contract: PluginContract | null;
  componentsModule: unknown | null;
  servicesModule: unknown | null;
  failure: PluginRuntimeFailure | null;
  lifecycle: PluginLifecycleSnapshot;
  activationPromise: Promise<void> | null;
  /** The plugin's activate() export, extracted during contract loading. */
  activate: PluginActivateFunction | null;
  /** Disposables pushed by the plugin's activate() via ActivationContext.subscriptions. */
  activationSubscriptions: Disposable[];
  /** The GhostApi instance created during activation, disposed on deactivation. */
  ghostApiInstance: GhostApiInstance | null;
  /** The plugin's optional deactivate() export, called before disposal. */
  deactivate: PluginDeactivateFunction | null;
  builtinServiceInstances: Map<string, unknown> | null;
  /** Module reference for builtin plugins — used by part-module-host to skip federation loading. */
  builtinModule: unknown | null;
}

export interface PluginRegistryDiagnostic {
  at: string;
  pluginId: string;
  level: "info" | "warn";
  code: string;
  message: string;
  cause?: unknown;
}

export interface PluginRegistrySnapshot {
  tenantId: string;
  diagnostics: PluginRegistryDiagnostic[];
  plugins: {
    id: string;
    enabled: boolean;
    loadStrategy: string;
    descriptor: TenantPluginDescriptor;
    contract: PluginContract | null;
    failure: PluginRuntimeFailure | null;
    lifecycle: PluginLifecycleSnapshot;
  }[];
}

export interface ShellPluginRegistry {
  registerBuiltinPlugin(contract: PluginContract, serviceInstances?: Record<string, unknown>, module?: unknown): void;
  registerManifestDescriptors(tenantId: string, descriptors: TenantPluginDescriptor[]): void;
  setEnabled(pluginId: string, enabled: boolean): Promise<void>;
  activateByAction(pluginId: string, actionId: string): Promise<boolean>;
  activateByView(pluginId: string, viewId: string): Promise<boolean>;
  activateByIntent(pluginId: string, intentId: string): Promise<boolean>;
  activateByEvent(pluginId: string, eventName: string): Promise<boolean>;
  /** Load a plugin's contract without activating — used by the activation planner. */
  preloadContract(pluginId: string): Promise<PluginContract | null>;
  resolveComponentCapability(requesterPluginId: string, capabilityId: string): Promise<unknown | null>;
  resolveServiceCapability(requesterPluginId: string, capabilityId: string): Promise<unknown | null>;
  getService<T = unknown>(serviceId: string): T | null;
  hasService(serviceId: string): boolean;
  /** Retrieve a builtin plugin's module reference, or null if not registered. */
  getBuiltinModule(pluginId: string): unknown | null;
  getSnapshot(): PluginRegistrySnapshot;
  subscribe(callback: () => void): { dispose(): void };
}

export interface ShellPluginRegistryOptions {
  pluginLoader?: PluginLoadStrategy;
  /** Dependencies for creating GhostApi instances during plugin activation. */
  apiDeps?: import("./plugin-api/ghost-api-factory.js").GhostApiFactoryDependencies;
  /** Optional LayerRegistry for registering/unregistering plugin layers during lifecycle. */
  layerRegistry?: import("@ghost-shell/layer").LayerRegistry;
}
