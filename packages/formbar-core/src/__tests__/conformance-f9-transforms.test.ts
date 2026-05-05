import { describe, expect, test } from "vitest";
import { createDateEgressTransform, createDateTransform, runTransforms, type TransformDefinition } from "../index.js";

describe("F9: Transform round-trip conformance", () => {
  test("F9.01: ingress transform converts external format to canonical state", () => {
    const ingressTransform: TransformDefinition = {
      id: "test:ingress-normalize",
      phase: "ingress",
      transform(value: unknown): unknown {
        if (typeof value === "string") return value.trim().toLowerCase();
        return value;
      },
    };

    const result = runTransforms([ingressTransform], "ingress", "  Hello World  ", { state: {} });
    expect(result).toBe("hello world");
  });

  test("F9.02: field transform converts Date objects to ISO strings", () => {
    const dateTransform = createDateTransform();
    const date = new Date("2025-06-15T10:30:00.000Z");

    const result = runTransforms([dateTransform], "field", date, { state: {} });
    expect(result).toBe("2025-06-15T10:30:00.000Z");
  });

  test("F9.03: egress transform converts canonical state to submit payload", () => {
    const egressTransform: TransformDefinition = {
      id: "test:egress-format",
      phase: "egress",
      transform(value: unknown): unknown {
        if (typeof value === "string") return value.toUpperCase();
        return value;
      },
    };

    const result = runTransforms([egressTransform], "egress", "hello", { state: {} });
    expect(result).toBe("HELLO");
  });

  test("F9.04: date round-trip: Date → field → ISO string → egress → ISO string", () => {
    const dateField = createDateTransform();
    const dateEgress = createDateEgressTransform();
    const transforms = [dateField, dateEgress];

    const date = new Date("2025-01-20T00:00:00.000Z");

    // Field phase: Date → ISO string
    const afterField = runTransforms(transforms, "field", date, { state: {} });
    expect(afterField).toBe("2025-01-20T00:00:00.000Z");

    // Egress phase: ISO string passes through
    const afterEgress = runTransforms(transforms, "egress", afterField, { state: {} });
    expect(afterEgress).toBe("2025-01-20T00:00:00.000Z");
  });

  test("F9.05: date-time round-trip with full ISO datetime", () => {
    const dateField = createDateTransform();
    const dateEgress = createDateEgressTransform();
    const transforms = [dateField, dateEgress];

    const datetime = new Date("2025-06-15T14:30:45.123Z");

    const afterField = runTransforms(transforms, "field", datetime, { state: {} });
    expect(afterField).toBe("2025-06-15T14:30:45.123Z");

    const afterEgress = runTransforms(transforms, "egress", afterField, { state: {} });
    expect(afterEgress).toBe("2025-06-15T14:30:45.123Z");
  });

  test("F9.06: custom ingress + field + egress pipeline produces correct output", () => {
    const transforms: TransformDefinition[] = [
      {
        id: "custom:ingress",
        phase: "ingress",
        transform(value: unknown): unknown {
          // External API sends cents, convert to dollars
          if (typeof value === "number") return value / 100;
          return value;
        },
      },
      {
        id: "custom:field",
        phase: "field",
        transform(value: unknown): unknown {
          // Round to 2 decimal places for display
          if (typeof value === "number") return Math.round(value * 100) / 100;
          return value;
        },
      },
      {
        id: "custom:egress",
        phase: "egress",
        transform(value: unknown): unknown {
          // Convert back to cents for submission
          if (typeof value === "number") return Math.round(value * 100);
          return value;
        },
      },
    ];

    const ctx = { state: {} };
    const afterIngress = runTransforms(transforms, "ingress", 1999, ctx);
    expect(afterIngress).toBe(19.99);

    const afterField = runTransforms(transforms, "field", afterIngress, ctx);
    expect(afterField).toBe(19.99);

    const afterEgress = runTransforms(transforms, "egress", afterField, ctx);
    expect(afterEgress).toBe(1999);
  });

  test("F9.07: path-scoped transforms only apply to matching paths", () => {
    const scopedTransform: TransformDefinition = {
      id: "test:scoped",
      phase: "field",
      path: "email",
      transform(value: unknown): unknown {
        if (typeof value === "string") return value.toLowerCase();
        return value;
      },
    };

    // Matching path — transform applies
    const matched = runTransforms([scopedTransform], "field", "USER@EXAMPLE.COM", { path: "email", state: {} });
    expect(matched).toBe("user@example.com");

    // Non-matching path — transform skipped, value unchanged
    const unmatched = runTransforms([scopedTransform], "field", "USER@EXAMPLE.COM", { path: "name", state: {} });
    expect(unmatched).toBe("USER@EXAMPLE.COM");
  });

  test("F9.08: transform ordering is stable (first registered, first executed)", () => {
    const log: string[] = [];
    const transforms: TransformDefinition[] = [
      {
        id: "first",
        phase: "field",
        transform(value: unknown): unknown {
          log.push("first");
          return `${value}-a`;
        },
      },
      {
        id: "second",
        phase: "field",
        transform(value: unknown): unknown {
          log.push("second");
          return `${value}-b`;
        },
      },
      {
        id: "third",
        phase: "field",
        transform(value: unknown): unknown {
          log.push("third");
          return `${value}-c`;
        },
      },
    ];

    const result = runTransforms(transforms, "field", "start", { state: {} });
    expect(result).toBe("start-a-b-c");
    expect(log).toEqual(["first", "second", "third"]);
  });

  test("F9.09: transforms are synchronous (no Promise return)", () => {
    const dateTransform = createDateTransform();
    const result = runTransforms([dateTransform], "field", new Date("2025-01-01T00:00:00.000Z"), { state: {} });

    // Result is a plain string, not a Promise
    expect(typeof result).toBe("string");
    expect(result).not.toBeInstanceOf(Promise);
  });

  test("F9.10: identity egress transform preserves canonical values", () => {
    const egressTransform = createDateEgressTransform();

    const values = ["2025-01-01T00:00:00.000Z", 42, true, null, "hello"];
    for (const val of values) {
      const result = runTransforms([egressTransform], "egress", val, { state: {} });
      expect(result).toBe(val);
    }
  });
});
