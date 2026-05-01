import type {
  ActivationContext,
  ContextApi,
  ContextToken,
  Disposable,
  GhostApi,
  PluginRouterServiceApi,
  PluginServices,
  ServiceRegistrationOptions,
  ServiceToken,
} from "@ghost-shell/contracts";
import { createContextForToken } from "../context-create.js";
import { createState, disposeState } from "../reactive-state.js";
import {
  type ActionServiceDependencies,
  type ActionServiceWithEmitter,
  createActionService,
} from "./action-service.js";
import { createMenuService, type MenuServiceDependencies } from "./menu-service.js";
import { createViewService, type ViewServiceDeps } from "./view-service.js";
import {
  createWindowService,
  type WindowServiceDependencies,
  type WindowServiceWithEmitter,
} from "./window-service.js";
import {
  createWorkspaceService,
  type WorkspaceServiceDependencies,
  type WorkspaceServiceWithEmitter,
} from "./workspace-service-impl.js";

/**
 * Dependencies needed to create a scoped GhostApi for a plugin.
 * Composed from ActionServiceDependencies + WindowServiceDependencies + ViewServiceDeps + WorkspaceServiceDependencies.
 */
export interface GhostApiFactoryDependencies extends ActionServiceDependencies, WindowServiceDependencies {
  readonly viewServiceDeps: ViewServiceDeps;
  readonly workspaceServiceDeps: WorkspaceServiceDependencies;
  readonly menuServiceDeps: MenuServiceDependencies;
  /** Optional router service API — provided when the shell router is initialized. */
  readonly routerService?: PluginRouterServiceApi | undefined;
}

/** Result of creating a scoped GhostApi, including shell-side handles. */
export interface GhostApiInstance {
  readonly api: GhostApi;
  readonly actionServiceHandle: ActionServiceWithEmitter;
  readonly windowServiceHandle: WindowServiceWithEmitter;
  readonly workspaceServiceHandle: WorkspaceServiceWithEmitter;
}

/**
 * Create a scoped GhostApi instance for a single plugin activation.
 * Assembles ActionService, WindowService, ViewService, and WorkspaceService from the provided dependencies.
 */
export function createGhostApi(deps: GhostApiFactoryDependencies): GhostApiInstance {
  const actionServiceHandle = createActionService(deps);
  const windowServiceHandle = createWindowService(deps);
  const viewService = createViewService(deps.viewServiceDeps);
  const workspaceServiceHandle = createWorkspaceService(deps.workspaceServiceDeps);
  const menuService = createMenuService(deps.menuServiceDeps);

  const api: GhostApi = {
    actions: actionServiceHandle.service,
    window: windowServiceHandle.service,
    views: viewService,
    workspaces: workspaceServiceHandle.service,
    menus: menuService,
    router: deps.routerService,
  };

  return { api, actionServiceHandle, windowServiceHandle, workspaceServiceHandle };
}

/**
 * Create an ActivationContext for a plugin.
 * The subscriptions array collects Disposables that are auto-disposed on deactivation.
 */
export function createActivationContext(
  pluginId: string,
  services: PluginServices,
  serviceRegistrar?: (tokenId: string, implementation: unknown, options?: ServiceRegistrationOptions) => Disposable,
  contextRegistry?: ContextApi,
): ActivationContext {
  const subscriptions: Disposable[] = [];

  const context: ContextApi | undefined = contextRegistry
    ? {
        contribute: contextRegistry.contribute.bind(contextRegistry),
        get: contextRegistry.get.bind(contextRegistry),
        subscribe: contextRegistry.subscribe.bind(contextRegistry),
        create<T extends object>(token: ContextToken<T>, init: T) {
          const result = createContextForToken(token, init, (c) => contextRegistry.contribute(c));
          subscriptions.push(result);
          return result;
        },
      }
    : undefined;

  return {
    pluginId,
    subscriptions,
    services,
    context,
    createState<S extends object>(initial: S): S {
      const state = createState(initial);
      subscriptions.push({ dispose: () => disposeState(state) });
      return state;
    },
    registerService<T>(token: ServiceToken<T>, implementation: T, options?: ServiceRegistrationOptions): Disposable {
      if (!serviceRegistrar) {
        throw new Error(`Service registration not available during activation of '${pluginId}'`);
      }
      const disposable = serviceRegistrar(token.id, implementation, options);
      subscriptions.push(disposable);
      return disposable;
    },
  };
}
