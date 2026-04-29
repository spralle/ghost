// Types

// Components
export { App } from "./App.js";
export type { ShellCoreApi, ShellPartHostAdapter } from "./app/contracts.js";
export { ReactShellHost } from "./app/ReactShellHost.js";
export type { ShellRuntime } from "./app/types.js";
export type { GhostShell, GhostShellOptions } from "./create-ghost-shell.js";
// API
export { createGhostShell } from "./create-ghost-shell.js";

// Reactive state primitives
export { createState, subscribeState, getStateSnapshot, disposeState, isManagedState, proxyMap, proxySet } from "./reactive-state.js";
export type { StateOp, StateSubscriber } from "./reactive-state.js";

// Stateful service registration utilities
export { createServiceState, isStatefulService, type StatefulService } from "./stateful-service-registration.js";

// Service gateway contracts and utilities
export type {
  ServiceCallRequest,
  ServiceCallResponse,
  StateSnapshotRequest,
  StateSnapshotResponse,
  GatewayStateOp,
  StateOpBatch,
  ServiceGatewayContract,
} from "./service-gateway-contract.js";
export { SERVICE_GATEWAY_CONTRACT } from "./service-gateway-contract.js";
export { createServiceGatewayHost, type ServiceRegistry } from "./service-gateway-host.js";
export { createReplicaFromSnapshot, applyOps } from "./service-gateway-apply.js";
export { createProjectedPluginServices, type ServiceGatewayTransport } from "./projected-plugin-services.js";

// Popout window initialization
export { initializePopout, type PopoutTransport, type PopoutInitResult } from "./popout-initialization.js";

// DOM style synchronization for cross-window theming
export type { DomSyncMutation, StyleElementMutation, RootAttributeMutation, DomStyleSnapshot, DomStyleObserver } from "./dom-style-sync.js";
export { createDomStyleObserver, applyDomStyleSnapshot, applyDomSyncMutations } from "./dom-style-sync.js";

// Legacy — kept for ReactShellHost backward compatibility
export { startShell } from "./start-shell.js";
