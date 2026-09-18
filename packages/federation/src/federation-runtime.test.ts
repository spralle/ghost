import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@module-federation/enhanced/runtime", () => ({
  createInstance: () => ({
    loadRemote: async () => null,
    registerRemotes: () => undefined,
  }),
}));

import { createShellFederationRuntime, isModuleFederationRuntimeInstance } from "./federation-runtime.js";

const CACHE_KEY = "__mf_module_cache__";

beforeEach(() => {
  Reflect.deleteProperty(globalThis, CACHE_KEY);
});

describe("isModuleFederationRuntimeInstance", () => {
  it("accepts only callable remote loaders", () => {
    expect(isModuleFederationRuntimeInstance({ loadRemote: async () => null })).toBe(true);
    expect(isModuleFederationRuntimeInstance({ loadRemote: "not callable" })).toBe(false);
    expect(isModuleFederationRuntimeInstance(null)).toBe(false);
  });
});

describe("module federation global cache", () => {
  it.each([undefined, null])("initializes and assigns back a %s cache", (initialCache) => {
    Reflect.set(globalThis, CACHE_KEY, initialCache);

    createShellFederationRuntime();

    const cache = Reflect.get(globalThis, CACHE_KEY);
    expect(cache).toMatchObject({ share: expect.any(Object), remote: {} });
    expect(Reflect.get(cache, "share")).toHaveProperty("react", expect.any(Object));
  });

  it("preserves an existing valid cache and its entries", () => {
    const existingModule = { loaded: true };
    const cache = { share: { react: existingModule }, remote: { plugin: "registered" } };
    Reflect.set(globalThis, CACHE_KEY, cache);

    createShellFederationRuntime();

    expect(Reflect.get(globalThis, CACHE_KEY)).toBe(cache);
    expect(cache.share.react).toBe(existingModule);
    expect(cache.remote.plugin).toBe("registered");
  });

  it.each([
    ["non-object cache", "invalid"],
    ["array cache", []],
  ])("replaces an invalid %s", (_label, invalidCache) => {
    Reflect.set(globalThis, CACHE_KEY, invalidCache);

    createShellFederationRuntime();

    const cache = Reflect.get(globalThis, CACHE_KEY);
    expect(cache).not.toBe(invalidCache);
    expect(Reflect.get(cache, "share")).toHaveProperty("react", expect.any(Object));
    expect(Reflect.get(cache, "remote")).toEqual({});
  });

  it("normalizes invalid cache branches without replacing the cache object", () => {
    const cache = { share: "invalid", remote: [] };
    Reflect.set(globalThis, CACHE_KEY, cache);

    createShellFederationRuntime();

    expect(Reflect.get(globalThis, CACHE_KEY)).toBe(cache);
    expect(cache.share).toHaveProperty("react", expect.any(Object));
    expect(cache.remote).toEqual({});
  });
});
