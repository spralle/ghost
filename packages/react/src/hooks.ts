import { useContext, useSyncExternalStore } from "react";
import type { ContextToken } from "@ghost-shell/contracts";
import type { ChildRouteDefinition } from "@ghost-shell/router";
import { GhostContext, type GhostContextValue } from "./ghost-context.js";

/**
 * Access the full GhostContextValue. Throws if called outside a GhostProvider.
 */
export function useGhostApi(): GhostContextValue {
  const ctx = useContext(GhostContext);
  if (!ctx) {
    throw new Error(
      "useGhostApi must be used within a <GhostProvider>. " +
        "Ensure your component is rendered by the ghost-shell React renderer.",
    );
  }
  return ctx;
}

/**
 * Get a service by ID from the mount context's runtime service registry.
 * Returns undefined if the service is not registered.
 */
export function useService<T>(serviceId: string): T | undefined {
  const { mountContext } = useGhostApi();
  return (mountContext.runtime.services.getService<T>(serviceId) ?? undefined) as T | undefined;
}

/**
 * Convenience hook for accessing plugin identity from context.
 */
export function usePluginContext(): { pluginId: string; partId: string } {
  const { pluginId, partId } = useGhostApi();
  return { pluginId, partId };
}

/**
 * Factory for creating typed service hooks.
 * Returns a hook that retrieves a specific service by its well-known ID.
 */
export function createServiceHook<T>(serviceId: string): () => T | undefined {
  return function useTypedService(): T | undefined {
    return useService<T>(serviceId);
  };
}

/**
 * Subscribe to a reactive context value using a typed ContextToken.
 * Uses useSyncExternalStore for concurrent-safe reads.
 */
export function useContextValue<T>(token: ContextToken<T>): T | undefined;
/**
 * @deprecated Use token-based overload.
 * Subscribe to a reactive context value by ID.
 */
export function useContextValue<T>(id: string): T | undefined;
export function useContextValue<T>(tokenOrId: ContextToken<T> | string): T | undefined {
  const id = typeof tokenOrId === "string" ? tokenOrId : tokenOrId.id;
  const { contextRegistry } = useGhostApi();

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!contextRegistry) return () => {};
      const disposable = contextRegistry.subscribe(id, onStoreChange);
      return () => disposable.dispose();
    },
    () => contextRegistry?.get<T>(id),
  );
}

/**
 * Factory: create a pre-typed hook for a specific context ID.
 * Usage: export const useActiveTheme = createContextHook<Theme>("ghost.context.activeTheme");
 */
export function createContextHook<T>(id: string): () => T | undefined {
  return function useTypedContext(): T | undefined {
    return useContextValue<T>(id);
  };
}

/**
 * Hook that returns the matched child route for the current parent route's child slot.
 * Uses the "ghost.router.childRoute" context value set by the shell router.
 */
export function useChildRoute(): ChildRouteDefinition | undefined {
  return useContextValue<ChildRouteDefinition>("ghost.router.childRoute");
}
