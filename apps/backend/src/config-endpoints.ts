import { checkPolicy, extractAccessContext, type PolicyCheckDeps, policyToResponse } from "./config-auth.js";
import type { ConfigLoaderOptions } from "./config-loader.js";
import { createTenantConfigProviders, validateTenantId } from "./config-loader.js";
import { auditConfigMutation } from "./config-mutation-audit.js";
import type {
  ConfigAuditLog,
  ConfigurationLayerEntry,
  ConfigurationPropertySchema,
  OverrideTracker,
} from "./config-stubs.js";
import { inspectKey, resolveConfiguration } from "./config-stubs.js";
import type { RequestInfo, Route, RouteParams } from "./router.js";
import { jsonResponse } from "./router.js";

async function loadLayerStack(options: ConfigLoaderOptions, tenantId: string): Promise<ConfigurationLayerEntry[]> {
  const providers = createTenantConfigProviders(options, tenantId);
  const [coreData, appData, tenantData] = await Promise.all([
    providers.core.load(),
    providers.app.load(),
    providers.tenant.load(),
  ]);

  return [
    { layer: "core", entries: coreData.entries },
    { layer: "app", entries: appData.entries },
    { layer: "tenant", entries: tenantData.entries },
  ];
}

export interface ConfigRouteOptions {
  schemaMap?: Map<string, ConfigurationPropertySchema> | undefined;
  auditLog?: ConfigAuditLog | undefined;
  overrideTracker?: OverrideTracker | undefined;
}

export function createConfigRoutes(
  loaderOptions: ConfigLoaderOptions,
  options?: ConfigRouteOptions | undefined,
): Route[] {
  const deps: PolicyCheckDeps = {
    schemaMap: options?.schemaMap,
    auditLog: options?.auditLog,
    overrideTracker: options?.overrideTracker,
  };
  return [
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/config$/,
      handler: (params) => handleGetResolvedConfig(loaderOptions, params),
    },
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/config-layers$/,
      handler: (params) => handleGetConfigLayers(loaderOptions, params),
    },
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: (params) => handleGetConfigKey(loaderOptions, params),
    },
    {
      method: "PUT",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: (params, request) => handlePutConfigKey(loaderOptions, deps, params, request),
    },
    {
      method: "DELETE",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: (params, request) => handleDeleteConfigKey(loaderOptions, deps, params, request),
    },
  ];
}

async function handleGetResolvedConfig(loaderOptions: ConfigLoaderOptions, params: RouteParams): Promise<Response> {
  const tenantId = params[0];
  if (!validateTenantId(tenantId)) {
    return jsonResponse({ error: "invalid_tenant_id" }, 400);
  }

  const layers = await loadLayerStack(loaderOptions, tenantId);
  const resolved = resolveConfiguration({ layers });
  return jsonResponse(resolved.entries);
}

async function handleGetConfigLayers(loaderOptions: ConfigLoaderOptions, params: RouteParams): Promise<Response> {
  const tenantId = params[0];
  if (!validateTenantId(tenantId)) {
    return jsonResponse({ error: "invalid_tenant_id" }, 400);
  }

  const providers = createTenantConfigProviders(loaderOptions, tenantId);
  const [coreData, appData, tenantData] = await Promise.all([
    providers.core.load(),
    providers.app.load(),
    providers.tenant.load(),
  ]);

  return jsonResponse({
    core: coreData.entries,
    app: appData.entries,
    tenant: tenantData.entries,
  });
}

async function handleGetConfigKey(loaderOptions: ConfigLoaderOptions, params: RouteParams): Promise<Response> {
  const tenantId = params[0];
  const key = params[1];
  if (!validateTenantId(tenantId)) {
    return jsonResponse({ error: "invalid_tenant_id" }, 400);
  }

  const layers = await loadLayerStack(loaderOptions, tenantId);
  const inspection = inspectKey({ layers }, key);

  if (inspection.effectiveValue === undefined) {
    return jsonResponse({ error: "not_found", key }, 404);
  }

  return jsonResponse({
    key,
    value: inspection.effectiveValue,
    inspection,
  });
}

async function handlePutConfigKey(
  loaderOptions: ConfigLoaderOptions,
  deps: PolicyCheckDeps,
  params: RouteParams,
  request: RequestInfo,
): Promise<Response> {
  const tenantId = params[0];
  const key = params[1];
  if (!validateTenantId(tenantId)) {
    return jsonResponse({ error: "invalid_tenant_id" }, 400);
  }

  const body = await request.body();
  if (body === null || typeof body !== "object" || !("value" in body)) {
    return jsonResponse({ error: "invalid_body", message: "Body must contain { value: ... }" }, 400);
  }

  const context = extractAccessContext(request.headers);
  const { decision, schema } = checkPolicy(key, deps, context, "tenant");
  const rejection = policyToResponse(decision);
  if (rejection !== undefined) {
    return rejection;
  }

  const providers = createTenantConfigProviders(loaderOptions, tenantId);
  const result = await providers.tenant.write(key, body.value);

  if (!result.success) {
    return jsonResponse({ error: "write_failed", message: result.error }, 500);
  }

  await auditConfigMutation(deps, context, schema, {
    action: "set",
    key,
    tenantId,
    value: body.value,
  });

  return jsonResponse({ success: true, key, revision: result.revision });
}

async function handleDeleteConfigKey(
  loaderOptions: ConfigLoaderOptions,
  deps: PolicyCheckDeps,
  params: RouteParams,
  request: RequestInfo,
): Promise<Response> {
  const tenantId = params[0];
  const key = params[1];
  if (!validateTenantId(tenantId)) {
    return jsonResponse({ error: "invalid_tenant_id" }, 400);
  }

  const context = extractAccessContext(request.headers);
  const { decision, schema } = checkPolicy(key, deps, context, "tenant");
  const rejection = policyToResponse(decision);
  if (rejection !== undefined) {
    return rejection;
  }

  const providers = createTenantConfigProviders(loaderOptions, tenantId);
  const result = await providers.tenant.remove(key);

  if (!result.success) {
    return jsonResponse({ error: "remove_failed", message: result.error }, 500);
  }

  await auditConfigMutation(deps, context, schema, {
    action: "remove",
    key,
    tenantId,
  });

  return jsonResponse({ success: true, key, revision: result.revision });
}
