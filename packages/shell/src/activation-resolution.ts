import type { PluginContract, PluginServices } from "@ghost-shell/contracts";

/**
 * Resolve the activation entry point for a plugin based on its contract
 * activation rules and the current runtime context.
 */
export function resolveActivationEntry(
  contract: PluginContract,
  exports: Record<string, Function>,
  runtimeContext: Record<string, unknown>,
): Function | null {
  const activations = contract.activations;
  if (!activations || activations.length === 0) return null;

  for (const rule of activations) {
    if (matchesWhen(runtimeContext, rule.when)) {
      const fn = exports[rule.entry];
      if (typeof fn === "function") return fn;
    }
  }
  return null;
}

/**
 * Evaluate whether a runtime context satisfies a `when` condition object.
 * Supports simple equality and `$eq`/`$ne` operators.
 */
export function matchesWhen(context: Record<string, unknown>, when: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(when)) {
    const actual = context[key];
    if (typeof expected === "object" && expected !== null) {
      const ops = expected as Record<string, unknown>;
      if ("$ne" in ops && actual === ops.$ne) return false;
      if ("$eq" in ops && actual !== ops.$eq) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

export function createNullServices(): PluginServices {
  return {
    getService: () => null,
    hasService: () => false,
  } as PluginServices;
}
