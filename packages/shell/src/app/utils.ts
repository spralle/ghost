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
