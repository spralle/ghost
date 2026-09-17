import type { PluginServices, ServiceToken } from "@ghost-shell/contracts";

type ResolveServiceById = <T = unknown>(id: string) => T | null;

export function createPluginServiceAccessor(resolveById: ResolveServiceById): PluginServices["getService"] {
  function getService<T>(token: ServiceToken<T>): T | null;
  function getService<T = unknown>(id: string): T | null;
  function getService<T>(tokenOrId: ServiceToken<T> | string): T | null {
    const id = typeof tokenOrId === "string" ? tokenOrId : tokenOrId.id;
    return resolveById<T>(id);
  }

  return getService;
}
