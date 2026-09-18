import { buildActivationPlan } from "./plugin-activation-plan.js";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export interface ActivationFailure {
  pluginId: string;
  reason: string;
  cause?: unknown;
}

export interface StartupActivationResult {
  activated: string[];
  skipped: string[];
  failed: string[];
  failures: ActivationFailure[];
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function createStartupResult(): StartupActivationResult {
  return { activated: [], skipped: [], failed: [], failures: [] };
}

async function activateLayer(
  layer: string[],
  registry: ShellPluginRegistry,
  result: StartupActivationResult,
  onProgress?: () => void,
): Promise<void> {
  await Promise.all(
    layer.map(async (pluginId) => {
      try {
        const success = await registry.activateByEvent(pluginId, "onStartup");
        if (success) {
          result.activated.push(pluginId);
        } else {
          result.failed.push(pluginId);
          result.failures.push({ pluginId, reason: "activation_returned_false" });
        }
      } catch (error: unknown) {
        result.failed.push(pluginId);
        result.failures.push({ pluginId, reason: extractErrorMessage(error), cause: error });
      }
      onProgress?.();
    }),
  );
}

/** Activate eager plugins in dependency order while preserving layer concurrency. */
export async function activateByStartupEvent(
  registry: ShellPluginRegistry,
  onProgress?: () => void,
): Promise<StartupActivationResult> {
  const result = createStartupResult();
  const allEnabled = registry.getSnapshot().plugins.filter((plugin) => plugin.enabled);
  if (allEnabled.length === 0) return result;

  const eager = allEnabled.filter((plugin) => plugin.descriptor.activationEvents?.includes("onStartup"));
  const lazy = allEnabled.filter((plugin) => !plugin.descriptor.activationEvents?.includes("onStartup"));
  result.skipped.push(...lazy.map((plugin) => plugin.id));
  if (eager.length === 0) return result;

  const plan = buildActivationPlan(
    eager.map((plugin) => ({
      id: plugin.id,
      pluginDependencies: plugin.descriptor.pluginDependencies ?? [],
    })),
  );
  for (const rejection of plan.rejected) {
    result.failed.push(rejection.pluginId);
    result.failures.push({ pluginId: rejection.pluginId, reason: "circular_dependency" });
  }
  for (const layer of plan.layers) {
    await activateLayer(layer, registry, result, onProgress);
  }
  return result;
}
