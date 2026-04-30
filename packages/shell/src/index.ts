// Types

// Components
export { App } from "./App.js";
export type { ShellCoreApi, ShellPartHostAdapter } from "./app/contracts.js";
export { ReactShellHost } from "./app/ReactShellHost.js";
export type { ShellRuntime } from "./app/types.js";
export type { GhostShell, GhostShellOptions } from "./create-ghost-shell.js";
// API
export { createGhostShell } from "./create-ghost-shell.js";
// DOM style synchronization for cross-window theming
export type {
  DomStyleObserver,
  DomStyleSnapshot,
  DomSyncMutation,
  RootAttributeMutation,
  StyleElementMutation,
} from "./dom-style-sync.js";
export { applyDomStyleSnapshot, applyDomSyncMutations, createDomStyleObserver } from "./dom-style-sync.js";
// Popout boot orchestrator
export {
  bootPopoutWindow,
  type PopoutBootContext,
  type PopoutBootError,
  type PopoutBootResult,
} from "./popout-boot.js";
// Popout window initialization
export {
  initializePopout,
  type PopoutInitOptions,
  type PopoutInitResult,
  type PopoutTransport,
} from "./popout-initialization.js";
// Popout manifest contract and registry
export type {
  PopoutManifest,
  PopoutManifestContract,
  PopoutPartDescriptor,
  PopoutPluginDescriptor,
} from "./popout-manifest.js";
export { POPOUT_MANIFEST_CONTRACT_ID } from "./popout-manifest.js";
export { createPopoutManifestHost, type PopoutManifestHostOptions } from "./popout-manifest-host.js";
export type { PopoutManifestRegistry } from "./popout-manifest-registry.js";
export { createPopoutManifestRegistry } from "./popout-manifest-registry.js";
export { createProjectedPluginServices, type ServiceGatewayTransport } from "./projected-plugin-services.js";
export type { StateOp, StateSubscriber } from "./reactive-state.js";
// Reactive state primitives
export {
  createState,
  disposeState,
  getStateSnapshot,
  isManagedState,
  proxyMap,
  proxySet,
  subscribeState,
} from "./reactive-state.js";
export { applyOps, createReplicaFromSnapshot } from "./service-gateway-apply.js";
// Service gateway contracts and utilities
export type {
  GatewayStateOp,
  ServiceCallRequest,
  ServiceCallResponse,
  ServiceGatewayContract,
  StateOpBatch,
  StateSnapshotRequest,
  StateSnapshotResponse,
} from "./service-gateway-contract.js";
export { SERVICE_GATEWAY_CONTRACT } from "./service-gateway-contract.js";
export {
  createLazySubscriptionManager,
  type LazySubscription,
  type LazySubscriptionManager,
  type LazySubscriptionManagerOptions,
} from "./lazy-subscription-manager.js";
export {
  createServiceGatewayHost,
  type ServiceGatewayHostOptions,
  type ServiceRegistry,
} from "./service-gateway-host.js";
// Window identity
export { resolveWindowIdentity, type WindowIdentity } from "./window-identity.js";
// Scomp peer abstraction
export type {
  ScompContractToken,
  ScompDisposable,
  ScompPeer,
  ScompRuntimeConfig,
  ScompServiceDefinition,
} from "./scomp-runtime.js";
// Part snapshot utilities for popout continuity
export { capturePartSnapshot, restorePartSnapshot, type PartSnapshot } from "./part-snapshot.js";
// Legacy — kept for ReactShellHost backward compatibility
export { startShell } from "./start-shell.js";
// Stateful service registration utilities
export { createServiceState, isStatefulService, type StatefulService } from "./stateful-service-registration.js";
