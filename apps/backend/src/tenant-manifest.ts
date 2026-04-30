import { discoverLocalUiPlugins } from "./local-ui-plugin-discovery.js";

export interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: {
    shell: string;
    pluginContract: string;
  };
  pluginDependencies?: string[];
  activationEvents?: string[];
  contributes?: Record<string, unknown>;
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}

export interface TenantManifestOverrideOptions {
  selectedLocalPluginIds?: readonly string[];
  pluginEntryUrlOverridesById?: ReadonlyMap<string, string>;
}

const DEFAULT_TENANT = "demo";

const DEFAULT_LOCAL_PLUGIN_ENTRY_URL_MAP = createDefaultLocalPluginEntryUrlMap({
  appsRoot: "plugins",
});

export function getDefaultLocalPluginEntryUrlMap(): ReadonlyMap<string, string> {
  return DEFAULT_LOCAL_PLUGIN_ENTRY_URL_MAP;
}

let inMemoryTenantPluginDescriptors: Record<string, TenantPluginDescriptor[]> = {
  demo: createCanonicalLocalTenantDescriptors(),
};

export function rebuildTenantManifest(extraPluginsDirs: readonly string[]): void {
  inMemoryTenantPluginDescriptors = {
    demo: createCanonicalLocalTenantDescriptors(extraPluginsDirs),
  };
}

export function createCanonicalLocalTenantDescriptors(extraPluginsDirs?: readonly string[]): TenantPluginDescriptor[] {
  const plugins = discoverLocalUiPlugins({
    appsRoot: "plugins",
    extraPluginsDirs,
  });

  return Array.from(plugins.values()).map((plugin) => ({
    id: plugin.id,
    version: plugin.version,
    entry: plugin.entry,
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
    pluginDependencies: plugin.pluginDependencies,
    activationEvents: plugin.activationEvents,
    contributes: plugin.contributes,
  }));
}

export function createDefaultLocalPluginEntryUrlMap(options: {
  appsRoot: string;
  host?: string;
  protocol?: "http" | "https";
  gatewayPort?: number;
  extraPluginsDirs?: readonly string[];
}): ReadonlyMap<string, string> {
  const discovered = discoverLocalUiPlugins(options);

  return new Map(Array.from(discovered, ([pluginId, plugin]) => [pluginId, plugin.entry]));
}

export function applyLocalPluginEntryOverrides(
  plugins: readonly TenantPluginDescriptor[],
  overrideOptions?: TenantManifestOverrideOptions,
): TenantPluginDescriptor[] {
  const selectedPluginIds = new Set(normalizeSelectedPluginIds(overrideOptions?.selectedLocalPluginIds));

  if (selectedPluginIds.size === 0) {
    return plugins.slice();
  }

  const entryOverridesByPluginId = overrideOptions?.pluginEntryUrlOverridesById ?? DEFAULT_LOCAL_PLUGIN_ENTRY_URL_MAP;

  const missingEntryOverridePluginIds = Array.from(selectedPluginIds).filter(
    (pluginId) => !entryOverridesByPluginId.get(pluginId),
  );

  if (missingEntryOverridePluginIds.length > 0) {
    throw new Error(
      `Missing local plugin override entry mapping for selected plugin id(s): ${missingEntryOverridePluginIds.join(", ")}.`,
    );
  }

  const availablePluginIdSet = new Set(plugins.map((plugin) => plugin.id));
  const missingManifestPluginIds = Array.from(selectedPluginIds).filter(
    (pluginId) => !availablePluginIdSet.has(pluginId),
  );

  if (missingManifestPluginIds.length > 0) {
    throw new Error(
      `Selected local plugin id(s) not present in tenant manifest: ${missingManifestPluginIds.join(", ")}.`,
    );
  }

  return plugins.map((plugin) => {
    if (!selectedPluginIds.has(plugin.id)) {
      return {
        ...plugin,
      };
    }

    const overriddenEntry = entryOverridesByPluginId.get(plugin.id);
    if (!overriddenEntry) {
      throw new Error(`Missing local plugin override entry mapping for selected plugin '${plugin.id}'.`);
    }

    return {
      ...plugin,
      entry: overriddenEntry,
    };
  });
}

export function getTenantManifestEndpointPath(tenantId: string): string {
  return `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
}

export function getTenantManifestResponse(
  tenantId: string,
  overrideOptions?: TenantManifestOverrideOptions,
): TenantPluginManifestResponse {
  const normalizedTenantId = tenantId.trim() || DEFAULT_TENANT;
  const plugins = inMemoryTenantPluginDescriptors[normalizedTenantId] ?? [];

  return {
    tenantId: normalizedTenantId,
    plugins: applyLocalPluginEntryOverrides(plugins, overrideOptions),
  };
}

export function resolveTenantManifestRequest(
  pathname: string,
  overrideOptions?: TenantManifestOverrideOptions,
): TenantPluginManifestResponse | null {
  const match = pathname.match(/^\/api\/tenants\/([^/]+)\/plugin-manifest$/);
  if (!match) {
    return null;
  }

  const tenantId = decodeURIComponent(match[1]);
  return getTenantManifestResponse(tenantId, overrideOptions);
}

export function normalizeSelectedPluginIds(selectedPluginIds: readonly string[] | undefined): string[] {
  if (!selectedPluginIds || selectedPluginIds.length === 0) {
    return [];
  }

  return Array.from(
    new Set(selectedPluginIds.map((pluginId) => pluginId.trim()).filter((pluginId) => pluginId.length > 0)),
  ).sort((left, right) => left.localeCompare(right));
}
