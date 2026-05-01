// plugin-registry-service-registration.ts — PluginRegistryService adapter and shell registration.

import type {
  Disposable,
  PluginContract,
  PluginContributionsSummary,
  PluginDependencySummary,
  PluginFailureInfo,
  PluginLifecycleInfo,
  PluginRegistryDiagnosticEntry,
  PluginRegistryEntry,
  PluginRegistryService,
  PluginRegistryServiceSnapshot,
  PluginReverseDependency,
} from "@ghost-shell/contracts";
import { PLUGIN_REGISTRY_SERVICE_ID } from "@ghost-shell/contracts";
import type { PluginRegistrySnapshot, ShellPluginRegistry } from "./plugin-registry-types.js";

export const PLUGIN_REGISTRY_SERVICE_PLUGIN_ID = "ghost.shell.plugin-registry-service";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface PluginRegistryServiceDeps {
  registry: ShellPluginRegistry;
  getPluginNotice: () => string;
}

// ---------------------------------------------------------------------------
// Contribution mapping helpers
// ---------------------------------------------------------------------------

function mapContributions(contract: PluginContract | null): PluginContributionsSummary {
  const c = contract?.contributes;
  return {
    views: (c?.views ?? []).map((v) => ({ id: v.id, title: v.title })),
    parts: (c?.parts ?? []).map((p) => ({ id: p.id, title: p.title })),
    actions: (c?.actions ?? []).map((a) => ({ id: a.id, title: a.title })),
    themes: (c?.themes ?? []).map((t) => ({ id: t.id, name: t.name, mode: t.mode })),
    keybindings: (c?.keybindings ?? []).map((k) => ({
      action: k.action,
      keybinding: k.keybinding,
    })),
    slots: (c?.slots ?? []).map((s) => ({
      id: s.id,
      slot: s.slot,
      position: s.position,
    })),
    layers: (c?.layers ?? []).map((l) => ({ id: l.name })),
    services: (c?.capabilities?.services ?? []).map((s) => ({
      id: s.id,
      version: s.version,
    })),
    components: (c?.capabilities?.components ?? []).map((comp) => ({
      id: comp.id,
      version: comp.version,
    })),
    hasConfiguration: !!(c?.configuration),
  };
}

function mapFailure(failure: { code: string; message: string; retryable: boolean } | null): PluginFailureInfo | null {
  if (!failure) return null;
  return { code: failure.code, message: failure.message, retryable: failure.retryable };
}

function mapLifecycle(lifecycle: {
  lastTransitionAt: string;
  lastTrigger: { type: string; id: string } | null;
}): PluginLifecycleInfo {
  return {
    lastTransitionAt: lifecycle.lastTransitionAt,
    lastTrigger: lifecycle.lastTrigger,
  };
}

function mapDependencies(contract: PluginContract | null): PluginDependencySummary {
  const deps = contract?.dependsOn;
  return {
    plugins: (deps?.plugins ?? []).map((p) => p.pluginId),
    services: (deps?.services ?? []).map((s) => s.id),
    components: (deps?.components ?? []).map((c) => c.id),
  };
}

// ---------------------------------------------------------------------------
// Reverse dependency computation
// ---------------------------------------------------------------------------

/** Build a map from target id → reverse dependency entries across all plugins. */
export function computeReverseDependencies(snap: PluginRegistrySnapshot): Map<string, PluginReverseDependency[]> {
  const reverseMap = new Map<string, PluginReverseDependency[]>();

  // Build a lookup: service/component id → provider plugin id
  const serviceProviders = new Map<string, string>();
  const componentProviders = new Map<string, string>();
  for (const p of snap.plugins) {
    const caps = p.contract?.contributes?.capabilities;
    for (const svc of caps?.services ?? []) {
      serviceProviders.set(svc.id, p.id);
    }
    for (const comp of caps?.components ?? []) {
      componentProviders.set(comp.id, p.id);
    }
  }

  for (const p of snap.plugins) {
    const deps = p.contract?.dependsOn;
    for (const dep of deps?.plugins ?? []) {
      pushReverseDep(reverseMap, dep.pluginId, { pluginId: p.id, dependencyType: "plugin" });
    }
    for (const dep of deps?.services ?? []) {
      const provider = serviceProviders.get(dep.id);
      if (provider) {
        pushReverseDep(reverseMap, provider, { pluginId: p.id, dependencyType: "service" });
      }
    }
    for (const dep of deps?.components ?? []) {
      const provider = componentProviders.get(dep.id);
      if (provider) {
        pushReverseDep(reverseMap, provider, { pluginId: p.id, dependencyType: "component" });
      }
    }
  }

  return reverseMap;
}

function pushReverseDep(
  map: Map<string, PluginReverseDependency[]>,
  targetId: string,
  entry: PluginReverseDependency,
): void {
  let list = map.get(targetId);
  if (!list) {
    list = [];
    map.set(targetId, list);
  }
  list.push(entry);
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

function buildSnapshot(snap: PluginRegistrySnapshot): PluginRegistryServiceSnapshot {
  const reverseMap = computeReverseDependencies(snap);

  const plugins: PluginRegistryEntry[] = snap.plugins.map((p) => ({
    pluginId: p.id,
    name: p.contract?.manifest?.name ?? p.descriptor?.id ?? p.id,
    version: p.contract?.manifest?.version ?? p.descriptor?.version ?? "unknown",
    icon: p.contract?.manifest?.icon,
    enabled: p.enabled,
    status: p.lifecycle.state,
    contributions: mapContributions(p.contract),
    failure: mapFailure(p.failure),
    lifecycle: mapLifecycle(p.lifecycle),
    dependencies: mapDependencies(p.contract),
    reverseDependencies: reverseMap.get(p.id) ?? [],
    activationEvents: p.contract?.activationEvents ?? [],
  }));

  const diagnostics: PluginRegistryDiagnosticEntry[] = snap.diagnostics.map((d) => ({
    at: d.at,
    pluginId: d.pluginId,
    level: d.level,
    code: d.code,
    message: d.message,
  }));

  return { tenantId: snap.tenantId || null, plugins, diagnostics };
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerPluginRegistryServiceCapability(
  registry: ShellPluginRegistry,
  deps: PluginRegistryServiceDeps,
): void {
  let version = 0;
  let cachedVersion = -1;
  let cachedSnapshot: PluginRegistryServiceSnapshot | null = null;

  const service: PluginRegistryService = {
    getSnapshot(): PluginRegistryServiceSnapshot {
      if (version !== cachedVersion) {
        cachedSnapshot = buildSnapshot(deps.registry.getSnapshot());
        cachedVersion = version;
      }
      return cachedSnapshot!;
    },

    getPluginNotice(): string | null {
      const notice = deps.getPluginNotice();
      return notice || null;
    },

    subscribe(callback: () => void): Disposable {
      return deps.registry.subscribe(() => {
        version++;
        callback();
      });
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: PLUGIN_REGISTRY_SERVICE_PLUGIN_ID,
      name: "Plugin Registry Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [{ id: PLUGIN_REGISTRY_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [PLUGIN_REGISTRY_SERVICE_ID]: service }, undefined, {
    [PLUGIN_REGISTRY_SERVICE_ID]: { lazy: true },
  });
}
