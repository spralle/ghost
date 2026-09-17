import { createServiceToken } from "@ghost-shell/contracts";
import { describe, expect, it } from "vitest";
import { createPluginServiceAccessor } from "./plugin-service-accessor.js";

interface TestService {
  readonly value: string;
}

describe("createPluginServiceAccessor", () => {
  it("normalizes typed tokens to their runtime IDs", () => {
    const service: TestService = { value: "ready" };
    const accessor = createPluginServiceAccessor((id) => (id === "test.service" ? service : null));

    expect(accessor(createServiceToken<TestService>("test.service"))).toBe(service);
  });

  it("preserves string lookup behavior", () => {
    const service = { value: "legacy" };
    const accessor = createPluginServiceAccessor((id) => (id === "legacy.service" ? service : null));

    expect(accessor<TestService>("legacy.service")).toBe(service);
    expect(accessor("missing.service")).toBeNull();
  });
});
