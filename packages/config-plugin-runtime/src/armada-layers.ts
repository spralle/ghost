import { defineWeaver, Layers, replaceOnly } from "@weaver/config-types";

/**
 * Armada's canonical layer stack.
 * Order = rank: core (0) is lowest, session (4) is highest.
 */
export const armadaWeaver = defineWeaver([
  Layers.Static("core"),
  Layers.Static("app"),
  Layers.Static("tenant"),
  Layers.Personal("user"),
  Layers.Ephemeral("session", { merge: replaceOnly }),
] as const);
