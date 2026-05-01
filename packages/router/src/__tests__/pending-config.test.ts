import { describe, expect, it } from "vitest";
import { resolvePendingConfig } from "../core/pending-config.js";

describe("resolvePendingConfig", () => {
  const defaults = { pendingMs: 200, pendingComponent: "DefaultSpinner", errorComponent: "DefaultError" };

  it("uses defaults when no route config provided", () => {
    const result = resolvePendingConfig(defaults);
    expect(result).toEqual({
      pendingMs: 200,
      pendingComponent: "DefaultSpinner",
      errorComponent: "DefaultError",
    });
  });

  it("route config overrides pendingMs", () => {
    const result = resolvePendingConfig(defaults, { pendingMs: 500 });
    expect(result.pendingMs).toBe(500);
    expect(result.pendingComponent).toBe("DefaultSpinner");
  });

  it("route config overrides pendingComponent", () => {
    const result = resolvePendingConfig(defaults, { pendingComponent: "CustomSpinner" });
    expect(result.pendingMs).toBe(200);
    expect(result.pendingComponent).toBe("CustomSpinner");
  });

  it("partial route config merges with defaults", () => {
    const result = resolvePendingConfig(defaults, { pendingMs: 100, errorComponent: "CustomError" });
    expect(result).toEqual({
      pendingMs: 100,
      pendingComponent: "DefaultSpinner",
      errorComponent: "CustomError",
    });
  });
});
