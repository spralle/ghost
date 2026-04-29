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

// Legacy — kept for ReactShellHost backward compatibility
export { startShell } from "./start-shell.js";
