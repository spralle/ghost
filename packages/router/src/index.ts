// Core
export type { PendingConfig, PendingDefaults } from "./core/pending-config.js";
export { resolvePendingConfig } from "./core/pending-config.js";

export { createActiveViewCodec } from "./codec/active-view-codec.js";
export { createUrlCodecRegistry } from "./codec/codec-registry.js";
// Codec types
export type { DecodedShellState, UrlCodecRegistry, UrlCodecState, UrlCodecStrategy } from "./codec/codec-types.js";
// Codec runtime
export { createWorkspaceHintCodec } from "./codec/workspace-hint-codec.js";
export { createWorkspaceRefCodec } from "./codec/workspace-ref-codec.js";
export type { HeadConfig, HeadManagerOptions, LinkTag, MetaTag } from "./core/head-types.js";
export { applyTitleTemplate, createHeadManager, mergeHeadConfigs } from "./core/head-manager.js";
export type {
  InferRouteParams,
  ResolvedRoute,
  RouteDefinition,
  RouteDefinitionMap,
  TypedRouteMap,
} from "./core/define-routes.js";
export { defineRoutes } from "./core/define-routes.js";
export type {
  NavigationGuard,
  NavigationGuardContext,
  NavigationGuardRegistry,
  NavigationGuardResult,
} from "./core/navigation-guard.js";
export { createNavigationGuardRegistry } from "./core/navigation-guard.js";
export type { PermissionChecker, RoutePermissionMap } from "./core/permission-guard.js";
export { createPermissionGuard } from "./core/permission-guard.js";
export type { AnyRouteMap, RouteId, RouteParams, RouteRef, RouteRefUnion } from "./core/route-map.js";
export type {
  LinkOpenPolicy,
  NavigationHints,
  NavigationResult,
  NavigationTarget,
  PlacementHint,
} from "./core/types.js";
export type { NavigationGuard as GuardType, NavigationGuardResult as GuardResultType } from "./core/guard-types.js";
export type { TypedIntentTarget, TypedRouteTarget } from "./core/typed-targets.js";
export { intentTarget, routeTarget, viewTarget } from "./core/typed-targets.js";
export type {
  NavigationEvent,
  NavigationEventSink,
  NavigationObserver,
  NavigationSource,
  SanitizedTarget,
} from "./core/navigation-observer.js";
export {
  createConsoleNavigationSink,
  createNavigationObserver,
  sanitizeTarget,
} from "./core/navigation-observer.js";
export type { PlacementCapabilities } from "./core/resolve-placement-hint.js";
export { resolvePlacementHint } from "./core/resolve-placement-hint.js";
export type { AttachNavigationOptions } from "./dom/attach-navigation.js";
export { attachNavigation } from "./dom/attach-navigation.js";
export { createDelegatedNavigation, parseNavigationTarget } from "./dom/delegated-navigation.js";
export type { LinkInterceptorOptions } from "./dom/link-interceptor.js";
export { createLinkInterceptor, parseGhostUrl } from "./dom/link-interceptor.js";
// DOM
export type {
  DelegatedNavigationOptions,
  NavigationAttachment,
  NavigationHandlerOptions,
  NavigationModifierMap,
} from "./dom/link-types.js";
export { DEFAULT_MODIFIER_MAP, NAVIGATION_DATA_ATTRIBUTES } from "./dom/link-types.js";
export type { CreateNavigationHandlerOptions } from "./dom/navigation-handler.js";
// DOM runtime
export { createNavigationHandler, resolveHintsFromEvent, resolveModifiers } from "./dom/navigation-handler.js";
export type { CreatePluginRouterOptions } from "./plugin/plugin-router.js";
// Plugin runtime
export { createPluginRouter } from "./plugin/plugin-router.js";
export type { PluginRouterServiceDeps } from "./plugin/plugin-router-service.js";
export { createPluginRouterService } from "./plugin/plugin-router-service.js";
// Plugin types
export type { PluginRouter, PluginRouterService } from "./plugin/plugin-router-types.js";
export type { HistoryAdapter } from "./shell/history-adapter.js";
export { createBrowserHistoryAdapter } from "./shell/history-adapter.js";
// Navigation runtime
export { createNavigationRuntime } from "./shell/navigation-runtime.js";
export type { IntentResolutionResult, NavigationDelegate } from "./shell/navigation-runtime-types.js";
export type { InitRouterOptions, RouterInitResult } from "./shell/setup.js";
export { initRouter } from "./shell/setup.js";
export type { CreateShellRouterOptions } from "./shell/shell-router.js";
// Shell runtime
export { createShellRouter } from "./shell/shell-router.js";
// Shell types
export type {
  ShellContextStateSnapshot,
  ShellRouter,
  ShellRouterConfig,
  ShellRouterStateSnapshot,
  ShellStateObserver,
  StateChangeHint,
} from "./shell/shell-router-types.js";
