import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createInMemoryOverrideTracker } from "@weaver/config-policy";
import { createInMemoryAuditLog } from "@weaver/config-server";
import { extractAccessContext } from "../src/config-auth.js";
import { createConfigRoutes } from "../src/config-endpoints.js";

/** Create a temporary config directory with seed data for testing. */
async function createTestConfigDir() {
  const dir = await mkdtemp(join(tmpdir(), "config-policy-test-"));
  await writeFile(join(dir, "core.json"), JSON.stringify({}));
  await writeFile(join(dir, "app.json"), JSON.stringify({}));
  await mkdir(join(dir, "tenants", "demo"), { recursive: true });
  await writeFile(join(dir, "tenants", "demo", "tenant.json"), JSON.stringify({ "existing.key": "value" }));
  return dir;
}

/** Schema fixtures for different change policies */
function createSchemaMap() {
  return new Map([
    ["direct.key", { type: "string", "x-weaver": { changePolicy: "direct-allowed" } }],
    ["staging.key", { type: "string", "x-weaver": { changePolicy: "staging-gate" } }],
    ["pipeline.key", { type: "string", "x-weaver": { changePolicy: "full-pipeline" } }],
    ["emergency.key", { type: "string", "x-weaver": { changePolicy: "emergency-override" } }],
  ]);
}

/** Default headers for a tenant-admin user */
const ADMIN_HEADERS = {
  "x-user-id": "admin-user",
  "x-tenant-id": "demo",
  "x-roles": "tenant-admin",
};

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

// --- extractAccessContext tests ---

test("extractAccessContext parses headers correctly", () => {
  const ctx = extractAccessContext({
    "x-user-id": "user-42",
    "x-tenant-id": "acme",
    "x-roles": "tenant-admin, platform-ops",
    "x-session-mode": "emergency-override",
    "x-override-reason": "Critical production fix",
  });

  assert.equal(ctx.userId, "user-42");
  assert.equal(ctx.tenantId, "acme");
  assert.deepEqual(ctx.roles, ["tenant-admin", "platform-ops"]);
  assert.equal(ctx.sessionMode, "emergency-override");
  assert.equal(ctx.overrideReason, "Critical production fix");
});

test("extractAccessContext defaults for missing headers", () => {
  const ctx = extractAccessContext({});

  assert.equal(ctx.userId, "anonymous");
  assert.equal(ctx.tenantId, "");
  assert.deepEqual(ctx.roles, []);
  assert.equal(ctx.sessionMode, undefined);
  assert.equal(ctx.overrideReason, undefined);
});

// --- PUT policy enforcement tests ---

test("PUT with direct-allowed key succeeds (200)", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap() });
    const res = await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/direct.key",
      { value: "new-value" },
      ADMIN_HEADERS,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.key, "direct.key");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PUT with staging-gate key returns 409", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap() });
    const res = await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/staging.key",
      { value: "new-value" },
      ADMIN_HEADERS,
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, "promotion_required");
    assert.ok(body.instructions);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PUT with full-pipeline key returns 409", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap() });
    const res = await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/pipeline.key",
      { value: "new-value" },
      ADMIN_HEADERS,
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, "promotion_required");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PUT with emergency-override key without auth returns 403", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap() });
    const res = await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/emergency.key",
      { value: "new-value" },
      ADMIN_HEADERS,
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "emergency_auth_required");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PUT with emergency-override key with proper session headers succeeds", async () => {
  const dir = await createTestConfigDir();
  try {
    const auditLog = createInMemoryAuditLog();
    const overrideTracker = createInMemoryOverrideTracker();
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap(), auditLog, overrideTracker });
    const res = await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/emergency.key",
      { value: "emergency-value" },
      {
        ...ADMIN_HEADERS,
        "x-session-mode": "emergency-override",
        "x-override-reason": "Production is down",
      },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- DELETE policy enforcement ---

test("DELETE with policy enforcement rejects staging-gate key", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap() });
    const res = await callRoute(routes, "DELETE", "/api/tenants/demo/config/staging.key", undefined, ADMIN_HEADERS);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, "promotion_required");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- Audit and override tracking tests ---

test("audit entry created after successful write", async () => {
  const dir = await createTestConfigDir();
  try {
    const auditLog = createInMemoryAuditLog();
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap(), auditLog });
    await callRoute(routes, "PUT", "/api/tenants/demo/config/direct.key", { value: "audited-value" }, ADMIN_HEADERS);

    const entries = await auditLog.getRecent(10);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].key, "direct.key");
    assert.equal(entries[0].actor, "admin-user");
    assert.equal(entries[0].action, "set");
    assert.equal(entries[0].newValue, "audited-value");
    assert.equal(entries[0].isEmergencyOverride, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("emergency override record created after emergency write", async () => {
  const dir = await createTestConfigDir();
  try {
    const auditLog = createInMemoryAuditLog();
    const overrideTracker = createInMemoryOverrideTracker();
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap(), auditLog, overrideTracker });
    await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/emergency.key",
      { value: "override-value" },
      {
        ...ADMIN_HEADERS,
        "x-session-mode": "emergency-override",
        "x-override-reason": "System down",
      },
    );

    const active = await overrideTracker.listActive();
    assert.equal(active.length, 1);
    assert.equal(active[0].key, "emergency.key");
    assert.equal(active[0].reason, "System down");
    assert.equal(active[0].actor, "admin-user");

    // Audit entry should also be marked as emergency
    const entries = await auditLog.getRecent(10);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].isEmergencyOverride, true);
    assert.equal(entries[0].overrideReason, "System down");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing schema defaults to direct-allowed (write succeeds)", async () => {
  const dir = await createTestConfigDir();
  try {
    const routes = createConfigRoutes({ configDir: dir }, { schemaMap: createSchemaMap() });
    // "unknown.key" is not in the schemaMap → defaults to allowed
    const res = await callRoute(
      routes,
      "PUT",
      "/api/tenants/demo/config/unknown.key",
      { value: "any-value" },
      ADMIN_HEADERS,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
