import { describe, expect, test } from "vitest";
import type { ValidationIssue } from "../state.js";
import { dedupeIssues, normalizeIssues, sortIssues } from "../validation.js";

const orderedStages = ["draft", "submit", "approve"] as const;

function issue(overrides: Partial<ValidationIssue> & { code: string }): ValidationIssue {
  return {
    stage: "draft",
    severity: "error",
    path: { namespace: "data", segments: ["a"] },
    message: "msg",
    source: { origin: "standard-schema", validatorId: "v1" },
    ...overrides,
  };
}

describe("sortIssues", () => {
  test("sorts by stage order", () => {
    const issues = [
      issue({ code: "E1", stage: "approve" }),
      issue({ code: "E1", stage: "draft" }),
      issue({ code: "E1", stage: "submit" }),
    ];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.stage)).toEqual(["draft", "submit", "approve"]);
  });

  test("sorts by severity (error < warning < info)", () => {
    const issues = [
      issue({ code: "E1", severity: "info" }),
      issue({ code: "E1", severity: "error" }),
      issue({ code: "E1", severity: "warning" }),
    ];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.severity)).toEqual(["error", "warning", "info"]);
  });

  test("sorts by namespace (data < ui)", () => {
    const issues = [
      issue({ code: "E1", path: { namespace: "ui", segments: ["a"] } }),
      issue({ code: "E1", path: { namespace: "data", segments: ["a"] } }),
    ];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.path.namespace)).toEqual(["data", "ui"]);
  });

  test("sorts by path lexicographic", () => {
    const issues = [
      issue({ code: "E1", path: { namespace: "data", segments: ["b", "c"] } }),
      issue({ code: "E1", path: { namespace: "data", segments: ["a", "z"] } }),
      issue({ code: "E1", path: { namespace: "data", segments: ["b", "a"] } }),
    ];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.path.segments)).toEqual([
      ["a", "z"],
      ["b", "a"],
      ["b", "c"],
    ]);
  });

  test("sorts by code within same path", () => {
    const issues = [issue({ code: "Z1" }), issue({ code: "A1" })];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.code)).toEqual(["A1", "Z1"]);
  });

  test("sorts by validatorId within same code", () => {
    const issues = [
      issue({ code: "E1", source: { origin: "standard-schema", validatorId: "v2" } }),
      issue({ code: "E1", source: { origin: "standard-schema", validatorId: "v1" } }),
    ];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.source.validatorId)).toEqual(["v1", "v2"]);
  });

  test("sorts by message last", () => {
    const issues = [issue({ code: "E1", message: "beta" }), issue({ code: "E1", message: "alpha" })];
    const sorted = sortIssues(issues, orderedStages);
    expect(sorted.map((i) => i.message)).toEqual(["alpha", "beta"]);
  });

  test("empty issues returns empty", () => {
    expect(sortIssues([], orderedStages)).toEqual([]);
  });

  test("stable sort preserves insertion order for equal items", () => {
    const a = issue({ code: "E1", details: { id: 1 } });
    const b = issue({ code: "E1", details: { id: 2 } });
    const sorted = sortIssues([a, b], orderedStages);
    expect(sorted[0].details).toEqual({ id: 1 });
    expect(sorted[1].details).toEqual({ id: 2 });
  });
});

describe("dedupeIssues", () => {
  test("removes exact duplicates", () => {
    const i1 = issue({ code: "E1" });
    const result = dedupeIssues([i1, { ...i1 }, { ...i1 }]);
    expect(result).toHaveLength(1);
  });

  test("keeps different issues with same path", () => {
    const i1 = issue({ code: "E1" });
    const i2 = issue({ code: "E2" });
    const result = dedupeIssues([i1, i2]);
    expect(result).toHaveLength(2);
  });
});

describe("normalizeIssues", () => {
  test("combines dedupe and sort", () => {
    const issues = [
      issue({ code: "E1", stage: "submit" }),
      issue({ code: "E1", stage: "draft" }),
      issue({ code: "E1", stage: "draft" }), // duplicate
    ];
    const result = normalizeIssues(issues, orderedStages);
    expect(result).toHaveLength(2);
    expect(result[0].stage).toBe("draft");
    expect(result[1].stage).toBe("submit");
  });
});
