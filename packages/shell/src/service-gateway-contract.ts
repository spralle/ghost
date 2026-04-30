/**
 * Contract types for the cross-window service gateway.
 * These define the wire protocol between host and popout windows.
 */

// ---------------------------------------------------------------------------
// ServiceGateway — RPC for method calls
// ---------------------------------------------------------------------------

/** Request to call a service method on the host. */
export interface ServiceCallRequest {
  readonly tokenId: string;
  readonly method: string;
  readonly args: unknown[];
}

/** Response from a service method call. */
export interface ServiceCallResponse {
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: string;
}

/** Request to get the current state snapshot for a service. */
export interface StateSnapshotRequest {
  readonly tokenId: string;
}

/** Response with the full state snapshot. */
export interface StateSnapshotResponse {
  readonly tokenId: string;
  readonly snapshot: unknown;
}

// ---------------------------------------------------------------------------
// StateReplication — streaming ops from host to popout
// ---------------------------------------------------------------------------

/** A single state operation (from valtio subscribe). */
export interface GatewayStateOp {
  readonly op: string;
  readonly path: (string | number)[];
  readonly value: unknown;
  readonly prevValue?: unknown;
}

/** A batch of state operations for a service. */
export interface StateOpBatch {
  readonly tokenId: string;
  readonly ops: GatewayStateOp[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// ServiceGateway contract shape (for scomp peer provides/consumes)
// ---------------------------------------------------------------------------

/**
 * The contract provided by the host window.
 * Popout windows consume this to access services.
 */
export interface ServiceGatewayContract {
  /** Call a service method (request → response). */
  callService(request: ServiceCallRequest): Promise<ServiceCallResponse>;
  /** Get current state snapshot for initial sync. */
  getStateSnapshot(request: StateSnapshotRequest): Promise<StateSnapshotResponse>;
  /** Subscribe to state ops for all services (feed — async iterable). */
  stateOps(): AsyncIterable<StateOpBatch>;
}

/** Well-known contract name for the service gateway. */
export const SERVICE_GATEWAY_CONTRACT = "ghost.service-gateway" as const;
