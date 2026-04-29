/**
 * Utilities for registering builtin services with valtio-managed state.
 * Builtin services (registered before plugin activation) use createState directly
 * rather than going through ActivationContext.
 */

import { createState } from "./reactive-state.js";

/**
 * Create a managed state object for a builtin service.
 * Same as ctx.createState() but callable outside activation context.
 */
export { createState as createServiceState };

/**
 * Interface for a service that exposes observable state.
 * The framework uses this to detect which services can be replicated.
 */
export interface StatefulService<S extends object = object> {
  readonly state: S;
}

/**
 * Check if a service implementation exposes managed valtio state.
 */
export function isStatefulService(service: unknown): service is StatefulService {
  if (!service || typeof service !== "object") return false;
  return "state" in service && service.state !== null && typeof service.state === "object";
}
