// @weaver/config-types removed — inline stubs for defineWeaver, Layers, replaceOnly

/** Stub merge strategy (@weaver/config-types removed). */
function replaceOnly(): unknown {
  return { strategy: "replace-only" };
}

/** Stub layer builders (@weaver/config-types removed). */
const Layers = {
  Static: (name: string) => ({ kind: "static" as const, name }),
  Personal: (name: string) => ({ kind: "personal" as const, name }),
  Ephemeral: (name: string, opts?: { merge?: unknown }) => ({
    kind: "ephemeral" as const,
    name,
    merge: opts?.merge,
  }),
};

/** Stub defineWeaver — returns the layer stack as-is (@weaver/config-types removed). */
function defineWeaver<T>(layers: T): T {
  return layers;
}

/**
 * Ghost's canonical layer stack.
 * Order = rank: core (0) is lowest, session (4) is highest.
 */
export const ghostWeaver = defineWeaver([
  Layers.Static("core"),
  Layers.Static("app"),
  Layers.Static("tenant"),
  Layers.Personal("user"),
  Layers.Ephemeral("session", { merge: replaceOnly }),
] as const);
