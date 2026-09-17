import { describe, expect, it } from "vitest";
import { isModuleFederationRuntimeInstance } from "./federation-runtime.js";

describe("isModuleFederationRuntimeInstance", () => {
  it("accepts only callable remote loaders", () => {
    expect(isModuleFederationRuntimeInstance({ loadRemote: async () => null })).toBe(true);
    expect(isModuleFederationRuntimeInstance({ loadRemote: "not callable" })).toBe(false);
    expect(isModuleFederationRuntimeInstance(null)).toBe(false);
  });
});
