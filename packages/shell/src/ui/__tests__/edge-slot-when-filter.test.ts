import { describe, expect, it } from "vitest";
import { evaluateContributionPredicate } from "@ghost-shell/plugin-system";

/**
 * Tests for edge-slot when-predicate filtering logic.
 *
 * The evaluateContributionPredicate function uses dot-path traversal for predicate keys.
 * Facts from getContextFacts() use flat dotted keys (e.g. "layout.mode"), which the
 * evaluator resolves by traversing nested objects: facts["layout"]["mode"].
 *
 * These tests verify the filtering behavior used by edge-slot-renderer.
 */
describe("edge-slot when-predicate filtering", () => {
  it("passes when predicate matches a simple fact key", () => {
    const when = { mode: "compact" };
    const facts = { mode: "compact" };
    expect(evaluateContributionPredicate(when, facts)).toBe(true);
  });

  it("fails when predicate does not match a simple fact key", () => {
    const when = { mode: "compact" };
    const facts = { mode: "expanded" };
    expect(evaluateContributionPredicate(when, facts)).toBe(false);
  });

  it("always passes when predicate is undefined (no when = always show)", () => {
    expect(evaluateContributionPredicate(undefined, {})).toBe(true);
    expect(evaluateContributionPredicate(undefined, { mode: "compact" })).toBe(true);
  });

  it("passes with dot-path predicate against nested facts", () => {
    const when = { "layout.mode": "compact" };
    const facts = { layout: { mode: "compact" } };
    expect(evaluateContributionPredicate(when, facts)).toBe(true);
  });

  it("fails with dot-path predicate when nested value differs", () => {
    const when = { "layout.mode": "compact" };
    const facts = { layout: { mode: "expanded" } };
    expect(evaluateContributionPredicate(when, facts)).toBe(false);
  });

  it("passes when tabStripPosition matches via dot-path", () => {
    const when = { "layout.tabStripPosition": "top" };
    expect(evaluateContributionPredicate(when, { layout: { tabStripPosition: "top" } })).toBe(true);
    expect(evaluateContributionPredicate(when, { layout: { tabStripPosition: "bottom" } })).toBe(false);
  });

  it("requires all predicates to match (AND semantics)", () => {
    const when = { "layout.mode": "compact", "layout.tabStripPosition": "top" };
    const factsMatch = { layout: { mode: "compact", tabStripPosition: "top" } };
    const factsPartial = { layout: { mode: "compact", tabStripPosition: "bottom" } };
    const factsMismatch = { layout: { mode: "expanded", tabStripPosition: "bottom" } };

    expect(evaluateContributionPredicate(when, factsMatch)).toBe(true);
    expect(evaluateContributionPredicate(when, factsPartial)).toBe(false);
    expect(evaluateContributionPredicate(when, factsMismatch)).toBe(false);
  });

  it("fails when fact key is missing from context", () => {
    const when = { mode: "compact" };
    expect(evaluateContributionPredicate(when, {})).toBe(false);
  });
});
