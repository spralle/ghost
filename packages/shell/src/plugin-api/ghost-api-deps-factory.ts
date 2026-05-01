import type { ShellRuntime } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { openPartInstanceWithArgs } from "../part-instance-flow.js";
import { getEffectiveStrategy } from "../placement/get-effective-strategy.js";
import { toActionContext } from "../shell-runtime/action-context.js";
import { getVisiblePartDefinitions } from "../ui/parts-rendering.js";
import type { QuickPickBridge } from "../ui/quick-pick/quick-pick-bridge.js";
import type { WorkspaceSwitchDeps } from "../ui/workspace-switch.js";
import type { GhostApiFactoryDependencies } from "./ghost-api-factory.js";

/**
 * Construct GhostApiFactoryDependencies from the ShellRuntime and QuickPickBridge.
 * All deps are late-bound getters — safe because runtime.registry is populated
 * before activate() hooks run.
 */
export function createGhostApiDeps(
  runtime: ShellRuntime,
  quickPickBridge: QuickPickBridge,
  options?: {
    getWorkspaceSwitchDeps?: () => WorkspaceSwitchDeps;
  },
): GhostApiFactoryDependencies {
  return {
    getActionSurface: () => runtime.actionSurface,
    getActionContext: () => toActionContext(runtime),
    getIntentRuntime: () => runtime.intentRuntime,
    activatePlugin: (pluginId, triggerId) => runtime.registry.activateByAction(pluginId, triggerId),
    runtimeActionRegistry: runtime.runtimeActionRegistry,

    getWindowId: () => runtime.windowId,
    getIsPopout: () => runtime.isPopout,
    getHostWindowId: () => runtime.hostWindowId,
    getPopoutHandles: () => runtime.popoutHandles,
    getSelectedPartId: () => runtime.selectedPartId,
    renderQuickPick: (controller) => quickPickBridge.render(controller as never),
    dismissQuickPick: () => quickPickBridge.dismiss(),

    viewServiceDeps: {
      getPartDefinitions: () => {
        return getVisiblePartDefinitions(runtime);
      },
      openPartInstance: (input) => {
        const strategy = getEffectiveStrategy(runtime.placementRegistry, runtime.placementConfig);
        const result = openPartInstanceWithArgs(runtime.contextState, {
          ...input,
          placementStrategy: strategy,
          placementConfig: runtime.placementConfig,
        });
        updateContextState(runtime, result.state);
        runtime.selectedPartId = result.tabId;
        runtime.selectedPartTitle = input.tabLabel ?? input.definitionId;
        return result.tabId;
      },
    },

    workspaceServiceDeps: {
      getRuntime: () => runtime,
      getWorkspaceSwitchDeps:
        options?.getWorkspaceSwitchDeps ??
        (() => {
          throw new Error("WorkspaceSwitchDeps not configured — workspace switching unavailable");
        }),
    },

    menuServiceDeps: {
      getActionSurface: () => runtime.actionSurface,
      getIntentRuntime: () => runtime.intentRuntime,
    },
  };
}
