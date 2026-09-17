import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createConfigRoutes } from "../src/config-endpoints.js";
import { validateTenantId } from "../src/config-loader.js";

/** Create a temporary config directory with seed data for testing. */
async function createTestConfigDir() {
  const dir = await mkdtemp(join(tmpdir(), "config-test-"));
  await writeFile(
    join(dir, "core.json"),
    JSON.stringify({
      "ghost.shell.display.dateFormat": "YYYY-MM-DD",
      "ghost.shell.display.timezone": "UTC",
      "ghost.shell.behavior.autoSaveInterval": 30000,
    }),
  );
  await writeFile(join(dir, "app.json"), JSON.stringify({}));
  await mkdir(join(dir, "tenants", "demo"), { recursive: true });
  await writeFile(
    join(dir, "tenants", "demo", "tenant.json"),
    JSON.stringify({
      "ghost.shell.display.dateFormat": "DD/MM/YYYY",
      "ghost.shell.display.locale": "nl-NL",
    }),
  );
  return dir;
}

/** Helper to invoke a route handler by matching against the route list. */
async function callRoute(routes, method, pathname, bodyValue, headers = {}) {
  const body = bodyValue !== undefined ? () => Promise.resolve(bodyValue) : () => Promise.resolve(null);
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (!match || route.method !== method) continue;
    const params = {};
    for (let i = 1; i < match.length; i++) {
      params[i - 1] = match[i];
    }
    return route.handler(params, { method, pathname, body, headers });
  }
  return null;
}

// --- validateTenantId tests ---

test("validateTenantId accepts valid IDs", () => {
  assert.equal(validateTenantId("demo"), true);
  assert.equal(validateTenantId("acme-corp"), true);
  assert.equal(validateTenantId("a1"), true);
  assert.equal(validateTenantId("tenant-123-abc"), true);
});

test("validateTenantId rejects invalid IDs", () => {
  assert.equal(validateTenantId("../"), false);
  assert.equal(validateTenantId("Demo"), false);
  assert.equal(validateTenantId(""), false);
  assert.equal(validateTenantId("tenant/../../etc"), false);
  assert.equal(validateTenantId(".hidden"), false);
  assert.equal(validateTenantId("-starts-with-dash"), false);
  assert.equal(validateTenantId("has spaces"), false);
});

// --- config-endpoints tests ---

test("GET /config returns resolved merged config", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "GET", "/api/tenants/demo/config");
    assert.equal(res.status, 200);
    const body = await res.json();
    // Tenant override should win over core
    assert.equal(body["ghost.shell.display.dateFormat"], "DD/MM/YYYY");
    // Core value should be present
    assert.equal(body["ghost.shell.display.timezone"], "UTC");
    // Tenant-only value should be present
    assert.equal(body["ghost.shell.display.locale"], "nl-NL");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("GET /config/{key} returns value + inspection for existing key", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "GET", "/api/tenants/demo/config/ghost.shell.display.dateFormat");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.key, "ghost.shell.display.dateFormat");
    assert.equal(body.value, "DD/MM/YYYY");
    assert.ok(body.inspection);
    assert.equal(body.inspection.effectiveValue, "DD/MM/YYYY");
    assert.equal(body.inspection.effectiveLayer, "tenant");
    assert.equal(body.inspection.layerValues.core, "YYYY-MM-DD");
    assert.equal(body.inspection.layerValues.tenant, "DD/MM/YYYY");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("GET /config/{key} returns 404 for non-existent key", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "GET", "/api/tenants/demo/config/ghost.nonexistent.key");
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "not_found");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PUT /config/{key} writes value to tenant config", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "PUT", "/api/tenants/demo/config/ghost.shell.custom.key", {
      value: "custom-value",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.key, "ghost.shell.custom.key");

    // Verify the value was written to disk
    const tenantFile = join(dir, "tenants", "demo", "tenant.json");
    const content = JSON.parse(await readFile(tenantFile, "utf-8"));
    assert.equal(content["ghost.shell.custom.key"], "custom-value");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("DELETE /config/{key} removes value from tenant config", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "DELETE", "/api/tenants/demo/config/ghost.shell.display.dateFormat");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    // Verify the value was removed from disk
    const tenantFile = join(dir, "tenants", "demo", "tenant.json");
    const content = JSON.parse(await readFile(tenantFile, "utf-8"));
    assert.equal(content["ghost.shell.display.dateFormat"], undefined);
    // Other keys should still be present
    assert.equal(content["ghost.shell.display.locale"], "nl-NL");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("GET /config-layers returns per-layer breakdown", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "GET", "/api/tenants/demo/config-layers");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.core);
    assert.ok(body.app);
    assert.ok(body.tenant);
    assert.equal(body.core["ghost.shell.display.dateFormat"], "YYYY-MM-DD");
    assert.equal(body.tenant["ghost.shell.display.dateFormat"], "DD/MM/YYYY");
    assert.deepEqual(body.app, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("invalid tenant ID returns 400 on GET /config", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "GET", "/api/tenants/../config");
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_tenant_id");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("invalid tenant ID returns 400 on PUT /config/{key}", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "PUT", "/api/tenants/INVALID/config/ghost.test", { value: "x" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_tenant_id");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("config loading handles missing tenant directory gracefully", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    // "unknown" is valid but has no tenant directory
    const res = await callRoute(routes, "GET", "/api/tenants/unknown/config");
    assert.equal(res.status, 200);
    const body = await res.json();
    // Core values should still be present, just no tenant overrides
    assert.equal(body["ghost.shell.display.dateFormat"], "YYYY-MM-DD");
    assert.equal(body["ghost.shell.display.timezone"], "UTC");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PUT /config/{key} returns 400 for invalid body", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const res = await callRoute(routes, "PUT", "/api/tenants/demo/config/ghost.test", { notValue: "x" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_body");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("all endpoints return application/json content-type", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    const endpoints = [
      { method: "GET", path: "/api/tenants/demo/config" },
      { method: "GET", path: "/api/tenants/demo/config/ghost.shell.display.dateFormat" },
      { method: "GET", path: "/api/tenants/demo/config-layers" },
    ];
    for (const ep of endpoints) {
      const res = await callRoute(routes, ep.method, ep.path);
      assert.ok(
        res.headers.get("content-type").includes("application/json"),
        `Expected application/json for ${ep.method} ${ep.path}, got: ${res.headers.get("content-type")}`,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("GET /config-layers does not match /config/(.+) pattern", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir });
    // /config-layers should return per-layer breakdown, NOT a 404 for key "-layers"
    const res = await callRoute(routes, "GET", "/api/tenants/demo/config-layers");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok("core" in body, "Should have core layer in response");
    assert.ok("tenant" in body, "Should have tenant layer in response");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
