import { describe, expect, it } from "vitest";

describe("@formbar/from-schema public API surface", () => {
  it("exports expected symbols from main entry", async () => {
    const mod = await import("../index.js");
    const exports = Object.keys(mod).sort();

    expect(exports).toEqual(expect.arrayContaining(["createSchemaForm", "applyLayoutMiddleware", "FromSchemaError"]));
  });
});
