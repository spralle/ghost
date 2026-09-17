import assert from "node:assert/strict";
import test from "node:test";

import { createRouter, jsonResponse } from "../src/router.js";

test("jsonResponse returns JSON body with correct content-type and status", async () => {
  const response = jsonResponse({ message: "ok" }, 201);

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  const body = await response.json();
  assert.deepEqual(body, { message: "ok" });
});

test("createRouter matches route and returns handler response", async () => {
  const router = createRouter([
    {
      method: "GET",
      pattern: /^\/items$/,
      handler: () => jsonResponse({ items: [] }),
    },
  ]);

  const response = await router({
    method: "GET",
    pathname: "/items",
    body: () => Promise.resolve(null),
    headers: {},
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { items: [] });
});

test("createRouter returns 404 for unmatched path", async () => {
  const router = createRouter([
    {
      method: "GET",
      pattern: /^\/items$/,
      handler: () => jsonResponse({ items: [] }),
    },
  ]);

  const response = await router({
    method: "GET",
    pathname: "/unknown",
    body: () => Promise.resolve(null),
    headers: {},
  });

  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error, "not_found");
  assert.equal(body.message, "No route for /unknown");
});

test("createRouter returns 405 for matched path with wrong method", async () => {
  const router = createRouter([
    {
      method: "GET",
      pattern: /^\/items$/,
      handler: () => jsonResponse({ items: [] }),
    },
  ]);

  const response = await router({
    method: "POST",
    pathname: "/items",
    body: () => Promise.resolve(null),
    headers: {},
  });

  assert.equal(response.status, 405);
  const body = await response.json();
  assert.equal(body.error, "method_not_allowed");
});

test("createRouter extracts regex capture groups as params", async () => {
  const router = createRouter([
    {
      method: "GET",
      pattern: /^\/tenants\/([^/]+)\/config\/([^/]+)$/,
      handler: (params) => jsonResponse({ tenantId: params[0], key: params[1] }),
    },
  ]);

  const response = await router({
    method: "GET",
    pathname: "/tenants/demo/config/theme.color",
    body: () => Promise.resolve(null),
    headers: {},
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tenantId, "demo");
  assert.equal(body.key, "theme.color");
});

test("createRouter dispatches to correct route among multiple routes", async () => {
  const router = createRouter([
    {
      method: "GET",
      pattern: /^\/alpha$/,
      handler: () => jsonResponse({ route: "alpha" }),
    },
    {
      method: "POST",
      pattern: /^\/beta$/,
      handler: () => jsonResponse({ route: "beta-post" }),
    },
    {
      method: "GET",
      pattern: /^\/beta$/,
      handler: () => jsonResponse({ route: "beta-get" }),
    },
  ]);

  const alphaRes = await router({
    method: "GET",
    pathname: "/alpha",
    body: () => Promise.resolve(null),
    headers: {},
  });
  assert.equal((await alphaRes.json()).route, "alpha");

  const betaPostRes = await router({
    method: "POST",
    pathname: "/beta",
    body: () => Promise.resolve(null),
    headers: {},
  });
  assert.equal((await betaPostRes.json()).route, "beta-post");

  const betaGetRes = await router({
    method: "GET",
    pathname: "/beta",
    body: () => Promise.resolve(null),
    headers: {},
  });
  assert.equal((await betaGetRes.json()).route, "beta-get");
});
