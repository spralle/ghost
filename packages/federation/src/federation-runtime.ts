import * as pluginContracts from "@ghost-shell/contracts";
import * as ghostReact from "@ghost-shell/react";
import * as ghostUi from "@ghost-shell/ui";
import { createInstance, type ModuleFederation } from "@module-federation/enhanced/runtime";
import * as react from "react";
import * as reactDom from "react-dom";
import * as reactDomClient from "react-dom/client";
import * as reactJsxRuntime from "react/jsx-runtime";

type RuntimeCreateOptions = Parameters<typeof createInstance>[0];

/**
 * Keep shell/plugin contracts singleton-safe by preferring the already loaded
 * host instance across remotes. We provide each shared module via `lib` so the
 * runtime host can seed the MF shared scope — without a bundler plugin the
 * scope would otherwise be empty and remotes would resolve `undefined`.
 */
const SHARED_DEPENDENCIES: NonNullable<RuntimeCreateOptions["shared"]> = {
  "@ghost-shell/contracts": {
    version: "0.0.0",
    lib: () => pluginContracts,
    shareConfig: {
      singleton: true,
      requiredVersion: "^0.0.0",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  "@ghost-shell/ui": {
    version: "0.0.0",
    lib: () => ghostUi,
    shareConfig: {
      singleton: true,
      requiredVersion: "^0.0.0",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  react: {
    version: "18.3.1",
    lib: () => react,
    shareConfig: {
      singleton: true,
      requiredVersion: "^18.3.1",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  "react/jsx-runtime": {
    version: "18.3.1",
    lib: () => reactJsxRuntime,
    shareConfig: {
      singleton: true,
      requiredVersion: "^18.3.1",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  "react-dom": {
    version: "18.3.1",
    lib: () => reactDom,
    shareConfig: {
      singleton: true,
      requiredVersion: "^18.3.1",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  "react-dom/client": {
    version: "18.3.1",
    lib: () => reactDomClient,
    shareConfig: {
      singleton: true,
      requiredVersion: "^18.3.1",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
  "@ghost-shell/react": {
    version: "0.0.0",
    lib: () => ghostReact,
    shareConfig: {
      singleton: true,
      requiredVersion: "^0.0.0",
      strictVersion: false,
    },
    strategy: "loaded-first",
  },
};

/**
 * Seed the global MF module cache so that build-time generated shared wrapper
 * scripts (which eagerly check `globalThis.__mf_module_cache__.share[name]`)
 * find the host-provided modules immediately — even during `preloadAssets`
 * before the runtime's lazy `loadShare()` has fired.
 */
function seedGlobalShareCache(): void {
  const CACHE_KEY = "__mf_module_cache__";
  const g = globalThis as Record<string, unknown>;
  const cache = (g[CACHE_KEY] ??= { share: {}, remote: {} }) as {
    share: Record<string, unknown>;
    remote: Record<string, unknown>;
  };
  cache.share ??= {};
  cache.remote ??= {};

  const modules: Record<string, unknown> = {
    "@ghost-shell/contracts": pluginContracts,
    "@ghost-shell/ui": ghostUi,
    "@ghost-shell/react": ghostReact,
    react: react,
    "react/jsx-runtime": reactJsxRuntime,
    "react-dom": reactDom,
    "react-dom/client": reactDomClient,
  };

  for (const [name, mod] of Object.entries(modules)) {
    if (cache.share[name] === undefined) {
      cache.share[name] = mod;
    }
  }
}

export interface ShellFederationRuntime {
  registerRemote(descriptor: { id: string; entry: string }): void;
  loadRemoteModule(remoteId: string, exposeKey: string): Promise<unknown>;
  loadPluginContract(remoteId: string): Promise<unknown>;
  loadPluginComponents(remoteId: string): Promise<unknown>;
  loadPluginServices(remoteId: string): Promise<unknown>;
}

export function createShellFederationRuntime(): ShellFederationRuntime {
  // Seed the global cache before creating the instance so that any
  // preloadAssets calls during remote resolution find modules immediately.
  seedGlobalShareCache();

  const host = createInstance({
    name: "ghost_shell",
    remotes: [],
    shared: SHARED_DEPENDENCIES,
    shareStrategy: "loaded-first",
  });

  return {
    registerRemote(descriptor) {
      host.registerRemotes([
        {
          name: descriptor.id,
          entry: descriptor.entry,
        },
      ]);
    },
    async loadRemoteModule(remoteId, exposeKey) {
      const normalizedExposeKey = exposeKey.startsWith("./") ? exposeKey.slice(2) : exposeKey;
      return host.loadRemote<unknown>(`${remoteId}/${normalizedExposeKey}`);
    },
    async loadPluginContract(remoteId) {
      const contract = await this.loadRemoteModule(remoteId, "./pluginContract");
      return contract;
    },
    async loadPluginComponents(remoteId) {
      const components = await host.loadRemote<unknown>(`${remoteId}/pluginComponents`);
      return components;
    },
    async loadPluginServices(remoteId) {
      const services = await host.loadRemote<unknown>(`${remoteId}/pluginServices`);
      return services;
    },
  };
}

export function isModuleFederationRuntimeInstance(value: unknown): value is ModuleFederation {
  return Boolean(value) && typeof value === "object" && "loadRemote" in (value as object);
}