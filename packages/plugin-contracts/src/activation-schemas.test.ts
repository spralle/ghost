import { describe, expect, it } from "vitest";
import { activationRuleSchema } from "./activation-schemas.js";
import { activationRuleSchema as publicActivationRuleSchema } from "./schemas.js";

describe("activationRuleSchema", () => {
  it("accepts arbitrary string-keyed condition values", () => {
    const result = activationRuleSchema.parse({
      entry: "./activate.js",
      when: { enabled: true, retries: 2, metadata: { source: "tenant" }, empty: null },
    });

    expect(result.when).toEqual({ enabled: true, retries: 2, metadata: { source: "tenant" }, empty: null });
  });

  it("rejects non-object conditions", () => {
    expect(() => activationRuleSchema.parse({ entry: "./activate.js", when: "always" })).toThrow();
  });

  it("preserves the schemas module export", () => {
    expect(publicActivationRuleSchema).toBe(activationRuleSchema);
  });
});
