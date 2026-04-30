import type { TenantPluginDescriptor, TenantPluginManifestResponse } from "./types.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeForWindowName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function getStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage;
}

export function getCurrentUserId(): string {
  return "local-user";
}

export function createWindowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `window-${Math.random().toString(36).slice(2, 10)}`;
}

export function readPopoutParams(): {
  isPopout: boolean;
  tabId: string | null;
  hostWindowId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      isPopout: false,
      tabId: null,
      hostWindowId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const isPopout = params.get("popout") === "1";
  return {
    isPopout,
    tabId: isPopout ? (params.get("tabId") ?? params.get("partId")) : null,
    hostWindowId: isPopout ? params.get("hostWindowId") : null,
  };
}

function filterContributionArray(arr: unknown, requiredKey: string): Record<string, unknown>[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const filtered = arr.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && typeof (item as Record<string, unknown>)[requiredKey] === "string",
  );
  return filtered.length > 0 ? filtered : undefined;
}

export function parseTenantManifestFallback(input: unknown): TenantPluginManifestResponse {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid tenant manifest response: expected object");
  }

  const manifest = input as Partial<TenantPluginManifestResponse>;
  if (typeof manifest.tenantId !== "string" || !manifest.tenantId.trim()) {
    throw new Error("Invalid tenant manifest response: tenantId is required");
  }

  if (!Array.isArray(manifest.plugins)) {
    throw new Error("Invalid tenant manifest response: plugins must be an array");
  }

  const plugins = manifest.plugins.map((plugin: unknown, index: number): TenantPluginDescriptor => {
    if (!plugin || typeof plugin !== "object") {
      throw new Error(`Invalid tenant manifest response: plugins[${index}] must be an object`);
    }

    const descriptor = plugin as Partial<TenantPluginDescriptor>;
    if (
      typeof descriptor.id !== "string" ||
      typeof descriptor.version !== "string" ||
      typeof descriptor.entry !== "string" ||
      !descriptor.compatibility ||
      typeof descriptor.compatibility.shell !== "string" ||
      typeof descriptor.compatibility.pluginContract !== "string"
    ) {
      throw new Error(`Invalid tenant manifest response: plugins[${index}] has invalid descriptor shape`);
    }

    const result: TenantPluginDescriptor = {
      id: descriptor.id,
      version: descriptor.version,
      entry: descriptor.entry,
      compatibility: {
        shell: descriptor.compatibility.shell,
        pluginContract: descriptor.compatibility.pluginContract,
      },
    };

    if (
      Array.isArray(descriptor.pluginDependencies) &&
      descriptor.pluginDependencies.every((d): d is string => typeof d === "string")
    ) {
      result.pluginDependencies = descriptor.pluginDependencies;
    }

    if (
      Array.isArray(descriptor.activationEvents) &&
      descriptor.activationEvents.every((e): e is string => typeof e === "string")
    ) {
      result.activationEvents = descriptor.activationEvents;
    }

    if (descriptor.contributes && typeof descriptor.contributes === "object" && !Array.isArray(descriptor.contributes)) {
      const raw = descriptor.contributes as Record<string, unknown>;
      const contributes: Record<string, unknown> = {};

      // Validate known array contribution types
      const actions = filterContributionArray(raw.actions, "id");
      const keybindings = filterContributionArray(raw.keybindings, "action");
      const menus = filterContributionArray(raw.menus, "action");
      const parts = filterContributionArray(raw.parts, "id");

      if (actions) contributes.actions = actions;
      if (keybindings) contributes.keybindings = keybindings;
      if (menus) contributes.menus = menus;
      if (parts) contributes.parts = parts;

      // Pass through unknown contribution sections opaquely (future-proofing)
      const validatedKeys = ["actions", "keybindings", "menus", "parts"];
      for (const key of Object.keys(raw)) {
        if (!validatedKeys.includes(key)) {
          contributes[key] = raw[key];
        }
      }

      if (Object.keys(contributes).length > 0) {
        // Cast justified: known keys (actions, keybindings, menus, parts) are validated above;
        // unknown keys pass through opaquely for future-proofing. The type system cannot represent
        // "partially validated + opaque remainder" so we assert after construction.
        result.contributes = contributes as typeof result.contributes;
      }
    }

    return result;
  });

  return {
    tenantId: manifest.tenantId,
    plugins,
  };
}

export function safeParse(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable payload]";
  }
}

export function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable payload]";
  }
}
