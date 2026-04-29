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
// Popout window initialization
export { initializePopout, type PopoutInitResult, type PopoutTransport } from "./popout-initialization.js";
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
export { createServiceGatewayHost, type ServiceRegistry } from "./service-gateway-host.js";
// Legacy — kept for ReactShellHost backward compatibility
export { startShell } from "./start-shell.js";
// Stateful service registration utilities
export { createServiceState, isStatefulService, type StatefulService } from "./stateful-service-registration.js";
