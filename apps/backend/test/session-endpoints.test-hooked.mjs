import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createOverrideSessionProvider } from "@weaver/config-sessions";
import { createSessionRoutes } from "../src/session-endpoints.js";

const sessionControllers = [];

afterEach(() => {
  for (const controller of sessionControllers) {
    controller.dispose();
  }
  sessionControllers.length = 0;
});

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

function createTestRoutes() {
  const sessionController = createOverrideSessionProvider();
  sessionControllers.push(sessionController);
  const routes = createSessionRoutes({ sessionController });
  return { routes, sessionController };
}

test("GET /api/session/status returns inactive initially", async () => {
  const { routes } = createTestRoutes();
  const res = await callRoute(routes, "GET", "/api/session/status");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.active, false);
  assert.equal(body.session, null);
});

test("POST /api/session/activate creates session", async () => {
  const { routes } = createTestRoutes();
  const res = await callRoute(routes, "POST", "/api/session/activate", {
    reason: "testing god mode",
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.id);
  assert.equal(body.isActive, true);
  assert.equal(body.reason, "testing god mode");
  assert.ok(body.activatedAt);
  assert.ok(body.expiresAt);
});

test("POST /api/session/activate returns 409 when already active", async () => {
  const { routes } = createTestRoutes();
  // First activation
  await callRoute(routes, "POST", "/api/session/activate", {
    reason: "first session",
  });
  // Second activation should conflict
  const res = await callRoute(routes, "POST", "/api/session/activate", {
    reason: "second session",
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "session_already_active");
});

test("POST /api/session/activate returns 400 for invalid body", async () => {
  const { routes } = createTestRoutes();
  const res = await callRoute(routes, "POST", "/api/session/activate", {
    invalid: "no reason field",
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "invalid_body");
  assert.ok(body.details);
});

test("GET /api/session/status returns active after activation", async () => {
  const { routes } = createTestRoutes();
  await callRoute(routes, "POST", "/api/session/activate", {
    reason: "checking status",
  });
  const res = await callRoute(routes, "GET", "/api/session/status");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.active, true);
  assert.ok(body.session);
  assert.equal(body.session.reason, "checking status");
  assert.equal(body.session.isActive, true);
});

test("POST /api/session/deactivate clears session", async () => {
  const { routes } = createTestRoutes();
  // Activate first
  await callRoute(routes, "POST", "/api/session/activate", {
    reason: "to be deactivated",
  });
  // Deactivate
  const res = await callRoute(routes, "POST", "/api/session/deactivate");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.sessionId);
  assert.ok(body.deactivatedAt);
  assert.equal(typeof body.overridesCleared, "number");
  assert.equal(typeof body.auditRecorded, "boolean");
  // Verify session is now inactive
  const statusRes = await callRoute(routes, "GET", "/api/session/status");
  const statusBody = await statusRes.json();
  assert.equal(statusBody.active, false);
  assert.equal(statusBody.session, null);
});

test("POST /api/session/deactivate returns 404 when not active", async () => {
  const { routes } = createTestRoutes();
  const res = await callRoute(routes, "POST", "/api/session/deactivate");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, "no_active_session");
});
