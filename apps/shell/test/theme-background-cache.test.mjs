import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Mock setup — must come before importing the module under test.
// ---------------------------------------------------------------------------

/** @type {Map<string, Response>} */
const cacheStore = new Map();
const blobUrls = /** @type {string[]} */ ([]);
const revokedUrls = /** @type {string[]} */ ([]);
let fetchFn;

const mockCache = {
  async match(url) {
    const r = cacheStore.get(url);
    return r ? r.clone() : undefined;
  },
  async put(url, response) {
    cacheStore.set(url, response.clone());
  },
};

function installGlobals() {
  globalThis.window = /** @type {any} */ ({});
  globalThis.caches = /** @type {any} */ ({
    open: async () => mockCache,
  });

  let counter = 0;
  globalThis.URL.createObjectURL = (_blob) => {
    const blobUrl = `blob:mock-${++counter}`;
    blobUrls.push(blobUrl);
    return blobUrl;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    revokedUrls.push(url);
  };
  globalThis.fetch = (...args) => fetchFn(...args);
}

function clearGlobals() {
  delete globalThis.window;
  delete globalThis.caches;
  delete globalThis.fetch;
  cacheStore.clear();
  blobUrls.length = 0;
  revokedUrls.length = 0;
}

function makeFakeResponse(body = "image-data") {
  const blob = new Blob([body], { type: "image/png" });
  return new Response(blob, { status: 200 });
}

// ---------------------------------------------------------------------------
// Import once — bun runs .ts natively, no cache-busting needed.
// Module-level state (currentBlobUrl) is shared across tests, which is
// acceptable because the revocation test explicitly depends on it.
// ---------------------------------------------------------------------------

const { resolveBackgroundUrl, preloadBackgroundUrls } = await import(
  "../../../packages/theme/src/theme-background-cache.ts"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("resolveBackgroundUrl returns original URL when Cache API unavailable", async () => {
  clearGlobals();
  const url = "https://example.com/bg.png";
  const result = await resolveBackgroundUrl(url);
  assert.equal(result, url);
});

test("resolveBackgroundUrl caches and returns blob URL on miss", async () => {
  clearGlobals();
  installGlobals();
  fetchFn = async () => makeFakeResponse();

  const url = "https://example.com/bg.png";
  const result = await resolveBackgroundUrl(url);

  assert.ok(result.startsWith("blob:"), `Expected blob URL, got: ${result}`);
  assert.ok(cacheStore.has(url), "URL should be in cache");
  clearGlobals();
});

test("resolveBackgroundUrl returns blob URL from cache on hit", async () => {
  clearGlobals();
  installGlobals();
  // Pre-populate cache.
  cacheStore.set("https://example.com/cached.png", makeFakeResponse());
  let fetchCalled = false;
  fetchFn = async () => {
    fetchCalled = true;
    return makeFakeResponse();
  };

  const result = await resolveBackgroundUrl("https://example.com/cached.png");
  assert.ok(result.startsWith("blob:"));
  assert.equal(fetchCalled, false, "Should not fetch on cache hit");
  clearGlobals();
});

test("preloadBackgroundUrls fetches and caches uncached URLs", async () => {
  clearGlobals();
  installGlobals();
  const fetched = [];
  fetchFn = async (url) => {
    fetched.push(url);
    return makeFakeResponse();
  };
  // Pre-populate one URL.
  cacheStore.set("https://example.com/a.png", makeFakeResponse());

  preloadBackgroundUrls(["https://example.com/a.png", "https://example.com/b.png"]);

  // Give the fire-and-forget a tick to complete.
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(!fetched.includes("https://example.com/a.png"), "Should not re-fetch cached URL");
  assert.ok(fetched.includes("https://example.com/b.png"), "Should fetch uncached URL");
  assert.ok(cacheStore.has("https://example.com/b.png"), "Should cache fetched URL");
  clearGlobals();
});

test("previous blob URLs are revoked when new ones are created", async () => {
  clearGlobals();
  installGlobals();
  fetchFn = async () => makeFakeResponse();

  const first = await resolveBackgroundUrl("https://example.com/1.png");
  assert.ok(first.startsWith("blob:"));

  const second = await resolveBackgroundUrl("https://example.com/2.png");
  assert.ok(second.startsWith("blob:"));
  assert.ok(revokedUrls.includes(first), `Expected ${first} to be revoked`);
  clearGlobals();
});

test("fetch failure gracefully falls back to original URL", async () => {
  clearGlobals();
  installGlobals();
  fetchFn = async () => {
    throw new Error("Network error");
  };

  const url = "https://example.com/fail.png";
  const result = await resolveBackgroundUrl(url);
  assert.equal(result, url);
  clearGlobals();
});
