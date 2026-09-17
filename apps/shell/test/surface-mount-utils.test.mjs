import assert from "node:assert/strict";
import test from "node:test";
import { resolveSurfaceMount } from "../../../packages/shell/src/layer/surface-mount-utils.js";

const surface = { id: "test-surface", component: "TestComponent" };
const cleanup = () => {};
const fakeMountFn = () => cleanup;

function assertResolves(moduleValue, expected = cleanup) {
  const result = resolveSurfaceMount(moduleValue, surface);
  assert.equal(typeof result, "function");
  assert.equal(result({}, {}), expected);
}

test("resolves module.mount (bare named export)", () => {
  assertResolves({ mount: fakeMountFn });
});

test("resolves module.mountSurface", () => {
  assertResolves({ mountSurface: fakeMountFn });
});

test("resolves module.surfaces[component] as function", () => {
  assertResolves({ surfaces: { TestComponent: fakeMountFn } });
});

test("resolves module.default as function", () => {
  assertResolves({ default: fakeMountFn });
});

test("resolves module.default.mount", () => {
  assertResolves({ default: { mount: fakeMountFn } });
});

test("returns null for empty object", () => {
  assert.equal(resolveSurfaceMount({}, surface), null);
});

test("returns null for non-function mount value", () => {
  assert.equal(resolveSurfaceMount({ mount: "not-a-function" }, surface), null);
});

test("returns null for null module", () => {
  assert.equal(resolveSurfaceMount(null, surface), null);
});

test("mountSurface takes priority over mount", () => {
  const preferredCleanup = () => {};
  const mountSurfaceFn = () => preferredCleanup;
  assertResolves({ mountSurface: mountSurfaceFn, mount: fakeMountFn }, preferredCleanup);
});
