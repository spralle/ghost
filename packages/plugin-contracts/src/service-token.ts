/**
 * Binds a TypeScript service type to a service ID at runtime.
 * The phantom `__type` field carries the type but is never read at runtime.
 */
export interface ServiceToken<T> {
  readonly id: string;
  /** @internal Phantom field — carries the service type. Never read at runtime. */
  readonly __type: T;
}

/**
 * Creates a service token that binds a service type to a well-known ID.
 * The returned token is frozen and safe to use as a module-level constant.
 */
export function createServiceToken<T>(id: string): ServiceToken<T> {
  if (!id || typeof id !== "string") {
    throw new Error("Service token ID must be a non-empty string.");
  }
  return Object.freeze({ id, __type: undefined as unknown as T });
}
