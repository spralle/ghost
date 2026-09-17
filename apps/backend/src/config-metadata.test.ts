import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInMemoryOverrideTracker } from "@weaver/config-policy";
import { createInMemoryAuditLog, createServiceConfigurationService } from "@weaver/config-server";
import { createOverrideSessionProvider } from "@weaver/config-sessions";
import type { ConfigurationPropertySchema, ConfigurationService } from "@weaver/config-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backendSchemaMap } from "./config-bootstrap.js";
import { createConfigRoutes } from "./config-endpoints.js";
import { createRouter } from "./router.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createConfigDirectory(tenantIds = ["demo"]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "ghost-config-metadata-"));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, "core.json"), "{}");
  await writeFile(join(directory, "app.json"), "{}");
  for (const tenantId of tenantIds) {
    const tenantDirectory = join(directory, "tenants", tenantId);
    await mkdir(tenantDirectory, { recursive: true });
    await writeFile(join(tenantDirectory, "tenant.json"), "{}");
  }
  return directory;
}

function createPolicySchemas(): Map<string, ConfigurationPropertySchema> {
  return new Map([
    ["direct.key", { type: "string", "x-weaver": { changePolicy: "direct-allowed" } }],
    ["staging.key", { type: "string", "x-weaver": { changePolicy: "staging-gate" } }],
    ["pipeline.key", { type: "string", "x-weaver": { changePolicy: "full-pipeline" } }],
    ["emergency.key", { type: "string", "x-weaver": { changePolicy: "emergency-override" } }],
  ]);
}

function request(method: string, pathname: string, value?: unknown, headers: Record<string, string> = {}) {
  return { method, pathname, headers, body: async () => value };
}

function createConfigurationFixture() {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  const service: ConfigurationService = {
    get: () => undefined,
    getWithDefault: (_key, defaultValue) => defaultValue,
    getAtLayer: () => undefined,
    getForScope: () => undefined,
    inspect: (key) => ({ key, effectiveValue: undefined, effectiveLayer: undefined, layerValues: {} }),
    set(key, value) {
      for (const listener of listeners.get(key) ?? []) listener(value);
    },
    remove: () => {},
    onChange(key, listener) {
      const keyListeners = listeners.get(key) ?? new Set();
      keyListeners.add(listener);
      listeners.set(key, keyListeners);
      return () => keyListeners.delete(listener);
    },
    getNamespace: () => ({}),
  };
  return service;
}

describe("backend configuration metadata", () => {
  it("retains public x-weaver reload behavior", () => {
    expect(backendSchemaMap.get("port")?.["x-weaver"]?.reloadBehavior).toBe("restart-required");
    expect(backendSchemaMap.get("corsOrigin")?.["x-weaver"]?.reloadBehavior).toBe("hot");
  });

  it("marks restart-required changes but leaves hot changes active", () => {
    const configService = createConfigurationFixture();
    const service = createServiceConfigurationService({
      configService,
      namespace: "ghost.backend",
      schemaMap: backendSchemaMap,
    });
    const onRestartRequired = vi.fn();
    service.onRestartRequired(onRestartRequired);

    configService.set("ghost.backend.corsOrigin", "https://example.test");
    expect(service.pendingRestart).toBe(false);
    configService.set("ghost.backend.port", 9000);
    expect(service.pendingRestart).toBe(true);
    expect(onRestartRequired).toHaveBeenCalledOnce();
  });
});

describe("configuration mutation policy", () => {
  it("accepts direct writes and denies promotion-gated writes", async () => {
    const configDir = await createConfigDirectory();
    const router = createRouter(createConfigRoutes({ configDir }, { schemaMap: createPolicySchemas() }));

    const direct = await router(request("PUT", "/api/tenants/demo/config/direct.key", { value: "allowed" }));
    const staging = await router(request("PUT", "/api/tenants/demo/config/staging.key", { value: "denied" }));
    const pipeline = await router(request("DELETE", "/api/tenants/demo/config/pipeline.key"));

    expect(direct.status).toBe(200);
    expect(staging.status).toBe(409);
    expect(pipeline.status).toBe(409);
  });

  it("requires authorization and audits successful emergency mutations", async () => {
    const configDir = await createConfigDirectory();
    const auditLog = createInMemoryAuditLog();
    const overrideTracker = createInMemoryOverrideTracker();
    const router = createRouter(
      createConfigRoutes({ configDir }, { schemaMap: createPolicySchemas(), auditLog, overrideTracker }),
    );
    const emergencyHeaders = {
      "x-user-id": "operator",
      "x-session-mode": "emergency-override",
      "x-override-reason": "service unavailable",
    };

    const denied = await router(request("PUT", "/api/tenants/demo/config/emergency.key", { value: "blocked" }));
    const allowed = await router(
      request("PUT", "/api/tenants/demo/config/emergency.key", { value: "restored" }, emergencyHeaders),
    );
    const removed = await router(
      request("DELETE", "/api/tenants/demo/config/emergency.key", undefined, emergencyHeaders),
    );
    const auditEntries = await auditLog.getRecent(10);

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(new Set(auditEntries.map((entry) => entry.action))).toEqual(new Set(["set", "remove"]));
    expect(await overrideTracker.listActive()).toHaveLength(1);
  });

  it("isolates tenant writes", async () => {
    const configDir = await createConfigDirectory(["alpha", "beta"]);
    const router = createRouter(createConfigRoutes({ configDir }));

    await router(request("PUT", "/api/tenants/alpha/config/direct.key", { value: "alpha-only" }));
    const alpha = JSON.parse(await readFile(join(configDir, "tenants", "alpha", "tenant.json"), "utf8"));
    const beta = JSON.parse(await readFile(join(configDir, "tenants", "beta", "tenant.json"), "utf8"));

    expect(alpha["direct.key"]).toBe("alpha-only");
    expect(beta["direct.key"]).toBeUndefined();
  });

  it("rejects tenant traversal", async () => {
    const configDir = await createConfigDirectory();
    const router = createRouter(createConfigRoutes({ configDir }));

    const response = await router(request("PUT", "/api/tenants/../config/direct.key", { value: "blocked" }));

    expect(response.status).toBe(400);
  });
});

describe("configuration session lifecycle", () => {
  it("retains active overrides and clears them on deactivation", async () => {
    const controller = createOverrideSessionProvider();
    controller.activate({ reason: "incident response", activatedBy: "operator" });

    await controller.provider.write("ghost.backend.port", 9000);
    expect(controller.getSession()?.overrides).toEqual({ "ghost.backend.port": 9000 });

    const result = controller.deactivate();
    expect(result.overridesCleared).toBe(1);
    expect(controller.isActive()).toBe(false);
    expect((await controller.provider.load()).entries).toEqual({});
    controller.dispose();
  });
});
