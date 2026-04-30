/**
 * Scomp peer abstraction for cross-window service communication.
 * The actual transport (SharedWorker, WebSocket, etc.) is injected at boot.
 */

/** Minimal scomp peer interface used by shell */
export interface ScompPeer {
  /** Resolve a contract from a connected peer */
  resolve<T>(contract: ScompContractToken<T>): T;
  /** Register a service implementation */
  register<T>(definition: ScompServiceDefinition<T>): ScompDisposable;
  /** This peer's participant ID */
  readonly participantId: string;
}

export interface ScompContractToken<T> {
  readonly id: string;
  /** Branded type marker */
  readonly __brand?: T;
}

export interface ScompServiceDefinition<T> {
  readonly contract: ScompContractToken<T>;
  readonly implementation: T;
}

export interface ScompDisposable {
  dispose(): void;
}

export interface ScompRuntimeConfig {
  /** The window's ID — used as scomp participant ID */
  readonly windowId: string;
}
