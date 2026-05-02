// plugin-config-browser.tsx — Plugin discovery UI with lazy schema loading.
//
// Tier 1: Enumerate plugins with hasConfiguration via PluginRegistryService.
// Tier 2: On selection, load full schemas via PluginConfigCatalogService.

import type { PluginMountContext, PluginRegistryEntry, PluginRegistryService } from "@ghost-shell/contracts";
import {
  CONFIG_SERVICE_ID,
  type ConfigurationService,
  PLUGIN_CONFIG_CATALOG_SERVICE_ID,
  type PluginConfigCatalogService,
  PLUGIN_REGISTRY_SERVICE_ID,
} from "@ghost-shell/contracts";
import { useService } from "@ghost-shell/react";
import { Card, CardContent } from "@ghost-shell/ui";
import { useMemo, useState, useSyncExternalStore } from "react";
import { catalogEntriesToJsonSchema } from "../utils/catalog-to-json-schema.js";
import { PluginConfigSidebar } from "./plugin-config-sidebar.js";
import { PluginSettingsEditor } from "./plugin-settings-editor.js";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useRegistrySnapshot(registryService: PluginRegistryService) {
  return useSyncExternalStore(
    (cb) => {
      const sub = registryService.subscribe(cb);
      return () => sub.dispose();
    },
    () => registryService.getSnapshot(),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginConfigBrowser({ context }: { readonly context: PluginMountContext }) {
  const registryService = useService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE_ID);
  const catalogService = useService<PluginConfigCatalogService>(PLUGIN_CONFIG_CATALOG_SERVICE_ID);
  const configService = useService<ConfigurationService>(CONFIG_SERVICE_ID);

  // [DIAG] temporary
  console.debug("[settings-diag] services:", { registry: !!registryService, catalog: !!catalogService, config: !!configService });
  if (!registryService || !catalogService || !configService) {
    return (
      <Card>
        <CardContent className="p-6" role="status">
          <p style={{ fontSize: "13px", color: "var(--ghost-muted-foreground)" }}>
            Settings services are not yet available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PluginConfigBrowserInner
      context={context}
      registryService={registryService}
      catalogService={catalogService}
      configService={configService}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner component (services guaranteed)
// ---------------------------------------------------------------------------

interface InnerProps {
  readonly context: PluginMountContext;
  readonly registryService: PluginRegistryService;
  readonly catalogService: PluginConfigCatalogService;
  readonly configService: ConfigurationService;
}

function PluginConfigBrowserInner({
  context,
  registryService,
  catalogService,
  configService,
}: InnerProps) {
  const snapshot = useRegistrySnapshot(registryService);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);

  // Tier 1: filter to plugins with configuration
  const configurablePlugins: readonly PluginRegistryEntry[] = useMemo(
    () => {
      const r = snapshot.plugins.filter((p) => p.contributions.hasConfiguration && p.enabled);
      // [DIAG] temporary
      console.debug("[settings-diag] filter:", snapshot.plugins.length, "total,", r.length, "configurable", snapshot.plugins.map((p) => ({ id: p.pluginId, en: p.enabled, cfg: p.contributions.hasConfiguration, st: p.status })));
      return r;
    },
    [snapshot.plugins],
  );

  // React setState functions are stable references — no useCallback needed.
  const handleSelectPlugin = setSelectedPluginId;

  // Tier 2: lazy schema loading on selection
  const schema = useMemo(() => {
    if (!selectedPluginId) return null;
    const entries = catalogService.getSchemasByOwner(selectedPluginId);
    if (entries.size === 0) return null;
    return catalogEntriesToJsonSchema(entries);
  }, [selectedPluginId, catalogService]);

  const editingLayer = context.args.layer ?? "user";

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "var(--ghost-background)",
        color: "var(--ghost-foreground)",
      }}
    >
      <PluginConfigSidebar
        plugins={configurablePlugins}
        selectedPluginId={selectedPluginId}
        onSelectPlugin={handleSelectPlugin}
      />
      <div style={{ flex: 1, padding: "8px", overflow: "auto" }}>
        {!selectedPluginId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--ghost-muted-foreground)",
              fontSize: "13px",
            }}
          >
            Select a plugin to configure
          </div>
        )}
        {selectedPluginId && !schema && (
          <Card>
            <CardContent className="p-6" role="status">
              <p style={{ fontSize: "13px", color: "var(--ghost-muted-foreground)" }}>
                No configuration schema available for this plugin.
              </p>
            </CardContent>
          </Card>
        )}
        {selectedPluginId && schema && (
          <PluginSettingsEditor
            context={{
              ...context,
              args: {
                ...context.args,
                pluginId: selectedPluginId,
                layer: editingLayer,
                schema,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
