import { type ComposedPluginSlotContribution, composeEnabledPluginContributions } from "@ghost-shell/plugin-system";
import type { ShellRuntime } from "../app/types.js";

export function gatherSlotContributions(runtime: ShellRuntime): ComposedPluginSlotContribution[] {
  const snapshot = runtime.registry.getSnapshot();
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      contract: plugin.contract,
    })),
  );
  return composed.slots;
}

export function createSlotMountKey(contribution: ComposedPluginSlotContribution, runtime: ShellRuntime): string {
  const snapshot = runtime.registry.getSnapshot();
  const pluginSnapshot = snapshot.plugins.find((plugin) => plugin.id === contribution.pluginId);
  if (!pluginSnapshot) {
    return `${contribution.pluginId}|${contribution.id}|missing`;
  }
  const enabledState = pluginSnapshot.enabled ? "enabled" : "disabled";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  return [contribution.pluginId, contribution.id, enabledState, lifecycleState].join("|");
}
