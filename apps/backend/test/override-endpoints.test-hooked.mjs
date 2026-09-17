import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryOverrideTracker } from "@weaver/config-policy";
import { createInMemoryAuditLog } from "@weaver/config-server";
import { createOverrideRoutes } from "../src/override-endpoints.js";

/** Helper to invoke a route handler by matching against the route list. */
async function callRoute(routes, method, pathname, bodyValue, headers = {}, search = "") {
  const body = bodyValue !== undefined ? () => Promise.resolve(bodyValue) : () => Promise.resolve(null);
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (!match || route.method !== method) continue;
    const params = {};
    for (let i = 1; i < match.length; i++) {
      params[i - 1] = match[i];
    }
    return route.handler(params, { method, pathname, body, headers, search });
  }
  return null;
}

/** Seed the override tracker with test records. */
async function seedOverrides(tracker) {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h ago

  await tracker.create({
    id: "override-1",
    key: "app.database.maxPool",
    actor: "ops-user",
    reason: "Database connection spike",
    tenantId: "demo",
    layer: "tenant",
    createdAt: now.toISOString(),
  });

  // Create an overdue override (created 48h ago, so past 24h deadline)
  await tracker.create({
    id: "override-2",
    key: "app.cache.ttl",
    actor: "ops-user",
    reason: "Cache thrashing incident",
    tenantId: "demo",
    layer: "tenant",
    createdAt: pastDate.toISOString(),
  });

  return { now, pastDate };
}

/** Seed audit log with test entries. */
async function seedAudit(auditLog) {
  await auditLog.append({
    timestamp: new Date().toISOString(),
    actor: "admin-user",
    action: "set",
    key: "app.feature.flag",
    layer: "tenant",
    tenantId: "demo",
    isEmergencyOverride: false,
  });

  await auditLog.append({
    timestamp: new Date().toISOString(),
    actor: "admin-user",
    action: "set",
    key: "app.database.maxPool",
    layer: "tenant",
    tenantId: "demo",
    isEmergencyOverride: true,
    overrideReason: "Scaling issue",
  });
}

test("GET /overrides returns active records", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();
  await seedOverrides(overrideTracker);

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "GET", "/api/tenants/demo/overrides");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2);
  assert.equal(body[0].key, "app.database.maxPool");
});

test("GET /overrides returns empty when none exist", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "GET", "/api/tenants/demo/overrides");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 0);
});

test("GET /overrides/overdue returns overdue records", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();
  await seedOverrides(overrideTracker);

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "GET", "/api/tenants/demo/overrides/overdue");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].key, "app.cache.ttl");
  assert.equal(body[0].id, "override-2");
});

test("POST /overrides/{id}/regularize marks override as regularized", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();
  await seedOverrides(overrideTracker);

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "POST", "/api/tenants/demo/overrides/override-1/regularize", {
    regularizedBy: "review-user",
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.regularizedBy, "review-user");
  assert.ok(body.regularizedAt);

  // Verify it's no longer active
  const activeRes = await callRoute(routes, "GET", "/api/tenants/demo/overrides");
  const active = await activeRes.json();
  assert.equal(active.length, 1); // Only override-2 remains active
});

test("POST /overrides/{id}/regularize with invalid ID returns 404", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "POST", "/api/tenants/demo/overrides/nonexistent-id/regularize", {
    regularizedBy: "review-user",
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, "not_found");
});

test("GET /audit returns audit entries", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();
  await seedAudit(auditLog);

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "GET", "/api/tenants/demo/audit");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2);
});

test("GET /audit with key filter returns filtered entries", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();
  await seedAudit(auditLog);

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "GET", "/api/tenants/demo/audit", undefined, {}, "?key=app.feature.flag");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].key, "app.feature.flag");
});

test("GET /overrides with invalid tenant returns 400", async () => {
  const overrideTracker = createInMemoryOverrideTracker();
  const auditLog = createInMemoryAuditLog();

  const routes = createOverrideRoutes({ auditLog, overrideTracker });
  const res = await callRoute(routes, "GET", "/api/tenants/INVALID!!/overrides");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_tenant_id");
});
