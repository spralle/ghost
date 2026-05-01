/**
 * Child slot registry for nested routing.
 * Allows plugins to contribute child routes to named slots declared on parent routes.
 */

export interface ChildRouteDefinition {
  readonly id: string;
  readonly path: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface ChildSlotRegistry {
  /** Contribute routes to a named slot. Returns a dispose function. */
  contributeRoutes(slotId: string, routes: readonly ChildRouteDefinition[]): () => void;
  /** Resolve a child route within a slot by route ID. */
  resolveChildRoute(slotId: string, routeId: string): ChildRouteDefinition | undefined;
  /** Get all routes contributed to a slot. */
  getSlotRoutes(slotId: string): readonly ChildRouteDefinition[];
}

/**
 * Create a new ChildSlotRegistry instance.
 */
export function createChildSlotRegistry(): ChildSlotRegistry {
  const slots = new Map<string, ChildRouteDefinition[]>();

  function contributeRoutes(slotId: string, routes: readonly ChildRouteDefinition[]): () => void {
    const existing = slots.get(slotId) ?? [];
    const contributed = [...routes];
    slots.set(slotId, [...existing, ...contributed]);

    return () => {
      const current = slots.get(slotId);
      if (!current) return;
      const filtered = current.filter((r) => !contributed.includes(r));
      if (filtered.length === 0) {
        slots.delete(slotId);
      } else {
        slots.set(slotId, filtered);
      }
    };
  }

  function resolveChildRoute(slotId: string, routeId: string): ChildRouteDefinition | undefined {
    const slotRoutes = slots.get(slotId);
    if (!slotRoutes) return undefined;
    return slotRoutes.find((r) => r.id === routeId);
  }

  function getSlotRoutes(slotId: string): readonly ChildRouteDefinition[] {
    return slots.get(slotId) ?? [];
  }

  return { contributeRoutes, resolveChildRoute, getSlotRoutes };
}
