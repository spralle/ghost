export type { ActivityStatusService, ActivityToken } from "./activity-status-service.js";
export { ACTIVITY_STATUS_SERVICE_ID } from "./activity-status-service.js";
export type { ConfigurationService } from "./config-service.js";
export { CONFIG_SERVICE_ID } from "./config-service.js";
export type { ContextContribution, ProviderContribution } from "./context-contribution.js";
export type {
  ContextApi,
  ContextContributionRegistry,
  ContextProviderSource,
} from "./context-contribution-registry.js";
export type { ContextService } from "./context-service.js";
export { CONTEXT_SERVICE_ID } from "./context-service.js";
export { createPluginContract } from "./create-plugin-contract.js";
export type { ReactPartsModule } from "./define-parts.js";
export { containsReactParts, findReactPartsModule, isReactPartsModule, REACT_PARTS_SYMBOL } from "./define-parts.js";
export type { ExtractActionIds, ExtractPartIds } from "./define-plugin.js";
export { definePlugin } from "./define-plugin.js";
export type { Disposable } from "./disposable.js";
export {
  INTENT_ENTITY_ASSIGN,
  INTENT_ENTITY_INSPECT,
  INTENT_ENTITY_OPEN,
} from "./domain-intents.js";
export type { Event, EventEmitter } from "./event.js";
export type {
  ActionDescriptor,
  ActionService,
  ActivationContext,
  DeactivationContext,
  GhostApi,
  InputBoxOptions,
  MenuService,
  OpenViewOptions,
  QuickPick,
  QuickPickItem,
  QuickPickOptions,
  ResolvedMenuAction,
  ViewDescriptor,
  ViewService,
  WindowDescriptor,
  WindowService,
} from "./ghost-api.js";
export type { ElementTransitionHook, HookService, TransitionContext } from "./hooks.js";
export { ELEMENT_TRANSITION_HOOK_ID, HOOK_REGISTRY_SERVICE_ID } from "./hooks.js";
export type {
  JsonFormCapability,
  JsonFormController,
  JsonFormLayoutNode,
  JsonFormOptions,
  JsonFormSchema,
} from "./jsonform-capability.js";
export type {
  KeybindingEntry,
  KeybindingOverride,
  KeybindingService,
  KeySequenceCancelledEvent,
  KeySequenceCompletedEvent,
  KeySequencePendingEvent,
} from "./keybinding-service.js";
export { KEYBINDING_SERVICE_ID } from "./keybinding-service.js";
export type {
  AutoStackConfig,
  FocusGrabConfig,
  LayerDefinition,
  LayerSurfaceContext,
  PluginLayerDefinition,
  PluginLayerSurfaceContribution,
} from "./layer-types.js";
export {
  AnchorEdge,
  InputBehavior,
  KeyboardInteractivity,
} from "./layer-types.js";
export type {
  ParsePluginContractResult,
  ParseTenantPluginManifestResult,
  PluginContractValidationIssue,
} from "./parsing.js";
export { parsePluginContract, parseTenantPluginManifest } from "./parsing.js";
export type { PartRenderContext, PartRenderer, PartRendererRegistry, PartRenderHandle } from "./part-renderer.js";
export type { PluginManagementService } from "./plugin-management-service.js";
export { PLUGIN_MANAGEMENT_SERVICE_ID } from "./plugin-management-service.js";
export type {
  CapabilityContributionItem,
  ContributionItem,
  KeybindingContributionItem,
  PluginContributionsSummary,
  PluginDependencySummary,
  PluginFailureInfo,
  PluginLifecycleInfo,
  PluginRegistryDiagnosticEntry,
  PluginRegistryEntry,
  PluginRegistryService,
  PluginRegistryServiceSnapshot,
  PluginReverseDependency,
  SlotContributionItem,
  ThemeContributionItem,
} from "./plugin-registry-service.js";
export { PLUGIN_REGISTRY_SERVICE_ID } from "./plugin-registry-service.js";
export type { MountPartFn, PartMountCleanup, PluginMountContext, PluginServices } from "./plugin-services.js";
export type { ResolveMountOptions } from "./resolve-mount.js";
export { resolveModuleMountFn } from "./resolve-mount.js";
export {
  activationEventsSchema,
  brandingContributionSchema,
  pluginActionContributionSchema,
  pluginCapabilityComponentContributionSchema,
  pluginCapabilityServiceContributionSchema,
  pluginCompatibilityMetadataSchema,
  pluginConfigurationContributionSchema,
  pluginContractSchema,
  pluginContributionsSchema,
  pluginDependenciesSchema,
  pluginDependencyComponentRequirementSchema,
  pluginDependencyPluginRequirementSchema,
  pluginDependencyServiceRequirementSchema,
  pluginDerivedLaneContributionSchema,
  pluginDragDropSessionReferenceSchema,
  pluginGalleryBannerSchema,
  pluginGallerySchema,
  pluginKeybindingContributionSchema,
  pluginLayerDefinitionSchema,
  pluginLayerSurfaceContributionSchema,
  pluginManifestIdentitySchema,
  pluginMenuContributionSchema,
  pluginPartContributionSchema,
  pluginPopoutCapabilityFlagsSchema,
  pluginProvidedCapabilitiesSchema,
  pluginSectionContributionSchema,
  pluginSelectionContributionSchema,
  pluginSlotContributionSchema,
  pluginViewContributionSchema,
  shellEdgeSlotPositionSchema,
  shellEdgeSlotSchema,
  tenantPluginDescriptorSchema,
  tenantPluginManifestResponseSchema,
  themeContributionSchema,
} from "./schemas.js";
export type { ServiceToken } from "./service-token.js";
export { createServiceToken } from "./service-token.js";
export * as ServiceTokens from "./service-tokens.js";
export {
  Action,
  ActivityStatus,
  Configuration,
  Context,
  Keybinding,
  Menu,
  PluginManagement,
  PluginRegistry,
  SyncStatus,
  Theme,
  View,
  Window,
  Workspace,
} from "./service-tokens.js";
export type { SyncStatusService } from "./sync-status-service.js";
export { SYNC_STATUS_SERVICE_ID } from "./sync-status-service.js";
export type { BackgroundInfo, ThemeInfo, ThemeService } from "./theme-service.js";
export { THEME_SERVICE_ID } from "./theme-service.js";
export type {
  FullThemePalette,
  PartialThemePalette,
  TerminalPalette,
  ThemeMode,
} from "./theme-types.js";
export {
  partialThemePaletteSchema,
  terminalPaletteSchema,
} from "./theme-types.js";
export type {
  BrandingContribution,
  BrandingLoadingScreen,
  BrandingLogo,
  ConfigurationPropertySchema,
  PluginActionContribution,
  PluginCapabilityComponentContribution,
  PluginCapabilityServiceContribution,
  PluginCompatibilityMetadata,
  PluginConfigurationContribution,
  PluginContract,
  PluginContractInput,
  PluginContributionPredicate,
  PluginContributions,
  PluginDependencies,
  PluginDependencyComponentRequirement,
  PluginDependencyPluginRequirement,
  PluginDependencyServiceRequirement,
  PluginDerivedLaneContribution,
  PluginDockableTabMetadata,
  PluginDragDropSessionReference,
  PluginGallery,
  PluginGalleryBanner,
  PluginKeybindingContribution,
  PluginManifestIdentity,
  PluginMenuContribution,
  PluginPartContribution,
  PluginPopoutCapabilityFlags,
  PluginProvidedCapabilities,
  PluginSectionContribution,
  PluginSelectionContribution,
  PluginSelectionInterest,
  PluginSlotContribution,
  PluginViewContribution,
  ShellEdgeSlot,
  ShellEdgeSlotPosition,
  TenantPluginDescriptor,
  TenantPluginManifestResponse,
  ThemeBackgroundEntry,
  ThemeContribution,
  ThemeFonts,
} from "./types.js";
export type { WorkspaceInfo, WorkspaceService } from "./workspace-service.js";
export { WORKSPACE_SERVICE_ID } from "./workspace-service.js";
