// plugin-registry-service.ts — Public PluginRegistryService contract for plugin consumption.
//
// Plugins access registry state via:
//   services.getService<PluginRegistryService>('ghost.pluginRegistry.Service')

import type { Disposable } from "./disposable.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Contribution item with enough detail for UI display. */
export interface ContributionItem {
  id: string;
  title?: string | undefined;
}

/** Theme contribution item with theme-specific metadata. */
export interface ThemeContributionItem {
  id: string;
  name: string;
  mode: string;
}

/** Keybinding contribution item. */
export interface KeybindingContributionItem {
  action: string;
  keybinding: string;
}

/** Slot contribution item. */
export interface SlotContributionItem {
  id: string;
  slot: string;
  position: string;
}

/** Capability contribution item (service or component). */
export interface CapabilityContributionItem {
  id: string;
  version: string;
}

/** Summary of all contributions a plugin provides. */
export interface PluginContributionsSummary {
  views: ContributionItem[];
  parts: ContributionItem[];
  actions: ContributionItem[];
  themes: ThemeContributionItem[];
  keybindings: KeybindingContributionItem[];
  slots: SlotContributionItem[];
  layers: ContributionItem[];
  services: CapabilityContributionItem[];
  components: CapabilityContributionItem[];
  hasConfiguration: boolean;
}

/** Failure details for a plugin that failed to load or activate. */
export interface PluginFailureInfo {
  code: string;
  message: string;
  retryable: boolean;
}

/** Lifecycle metadata for a plugin. */
export interface PluginLifecycleInfo {
  lastTransitionAt: string;
  lastTrigger: { type: string; id: string } | null;
}

/** Dependency summary — which plugins/services/components this plugin requires. */
export interface PluginDependencySummary {
  plugins: string[];
  services: string[];
  components: string[];
}

/** Reverse dependency — another plugin that depends on this one. */
export interface PluginReverseDependency {
  pluginId: string;
  dependencyType: "plugin" | "service" | "component";
}

/** Simplified plugin entry visible to consumers. */
export interface PluginRegistryEntry {
  pluginId: string;
  name: string;
  version: string;
  icon?: string | undefined;
  enabled: boolean;
  status: string;
  contributions: PluginContributionsSummary;
  failure: PluginFailureInfo | null;
  lifecycle: PluginLifecycleInfo;
  dependencies: PluginDependencySummary;
  reverseDependencies: PluginReverseDependency[];
  activationEvents: string[];
}

/** Registry-level diagnostic entry. */
export interface PluginRegistryDiagnosticEntry {
  at: string;
  pluginId: string;
  level: "info" | "warn";
  code: string;
  message: string;
}

/** Simplified registry snapshot visible to consumers. */
export interface PluginRegistryServiceSnapshot {
  tenantId: string | null;
  plugins: PluginRegistryEntry[];
  diagnostics: PluginRegistryDiagnosticEntry[];
}

// ---------------------------------------------------------------------------
// PluginRegistryService interface
// ---------------------------------------------------------------------------

export interface PluginRegistryService {
  /** Get a simplified snapshot of the current plugin registry state. */
  getSnapshot(): PluginRegistryServiceSnapshot;

  /** Get the current plugin notice message, or null if none. */
  getPluginNotice(): string | null;

  /** Subscribe to registry state changes. Returns a disposable to unsubscribe. */
  subscribe(callback: () => void): Disposable;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the PluginRegistryService. */
export const PLUGIN_REGISTRY_SERVICE_ID = "ghost.pluginRegistry.Service" as const;
