import { describe, expect, it } from "bun:test";
import { createSentinelSession } from "../create-sentinel-session.js";
import { evaluate } from "../evaluate.js";
import { toProductionRules } from "../to-production-rules.js";
import type { CompiledPolicy, CompiledRule, EvalContext } from "../types.js";

function makeContext(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    action: "read",
    principal: {
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["member"],
      partyIds: ["party-1"],
      orgChain: ["org-1"],
    },
    resource: { type: "document", ownerId: "user-1" },
    graph: {
      hasRelation: () => false,
    },
    ...overrides,
  };
}

function makeRule(overrides: Partial<CompiledRule> = {}): CompiledRule {
  return {
    name: "test-rule",
    effect: "grant",
    target: { kind: "action", action: "read" },
    condition: {},
    salience: 10,
    ...overrides,
  };
}

describe("toProductionRules", () => {
  it("converts a single action rule", () => {
    const rules = toProductionRules([makeRule()]);
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe("test-rule");
    expect(rules[0].salience).toBe(10);
    expect(rules[0].activationGroup).toBe("sentinel-decision");
  });

  it("merges target and condition into when clause", () => {
    const rule = makeRule({
      target: { kind: "action", action: "write" },
      condition: { "principal.roles": { $in: ["admin"] } },
    });
    const [prod] = toProductionRules([rule]);
    expect(prod.when).toEqual({
      "decision.effect": { $exists: false },
      "ctx.action": "write",
      "ctx.principal.roles": { $in: ["admin"] },
    });
  });

  it("handles dataBlock targets", () => {
    const rule = makeRule({
      target: { kind: "dataBlock", block: "financials" },
    });
    const [prod] = toProductionRules([rule]);
    expect((prod.when as Record<string, unknown>)["ctx.resource.block"]).toBe("financials");
  });

  it("preserves salience ordering", () => {
    const rules = toProductionRules([
      makeRule({ name: "deny-all", effect: "deny", salience: 100 }),
      makeRule({ name: "grant-read", effect: "grant", salience: 10 }),
    ]);
    expect(rules[0].salience).toBe(100);
    expect(rules[1].salience).toBe(10);
  });
});

describe("createSentinelSession", () => {
  it("returns a working session", () => {
    const policy: CompiledPolicy = { rules: [makeRule()] };
    const session = createSentinelSession(policy);
    expect(session).toBeDefined();
    expect(session.fire).toBeInstanceOf(Function);
    session.dispose();
  });

  it("accepts custom activation group", () => {
    const policy: CompiledPolicy = { rules: [makeRule()] };
    const session = createSentinelSession(policy, {
      activationGroup: "custom-group",
    });
    expect(session).toBeDefined();
    session.dispose();
  });
});

describe("evaluate", () => {
  it("returns default deny when no rules match", () => {
    const policy: CompiledPolicy = {
      rules: [makeRule({ target: { kind: "action", action: "delete" } })],
    };
    const ctx = makeContext({ action: "read" });
    const decision = evaluate(policy, ctx);
    expect(decision.effect).toBe("deny");
    expect(decision.reason).toContain("No matching");
  });

  it("grants when a grant rule matches", () => {
    const policy: CompiledPolicy = {
      rules: [makeRule({ name: "allow-read", effect: "grant", salience: 10 })],
    };
    const ctx = makeContext({ action: "read" });
    const decision = evaluate(policy, ctx);
    expect(decision.effect).toBe("allow");
    expect(decision.reason).toContain("allow-read");
  });

  it("denies when a deny rule matches", () => {
    const policy: CompiledPolicy = {
      rules: [makeRule({ name: "block-read", effect: "deny", salience: 100 })],
    };
    const ctx = makeContext({ action: "read" });
    const decision = evaluate(policy, ctx);
    expect(decision.effect).toBe("deny");
    expect(decision.reason).toContain("block-read");
  });

  it("deny wins over grant via salience (highest fires first)", () => {
    const policy: CompiledPolicy = {
      rules: [
        makeRule({ name: "grant-read", effect: "grant", salience: 10 }),
        makeRule({ name: "deny-read", effect: "deny", salience: 100 }),
      ],
    };
    const ctx = makeContext({ action: "read" });
    const decision = evaluate(policy, ctx);
    expect(decision.effect).toBe("deny");
    expect(decision.reason).toContain("deny-read");
  });

  it("reject is treated as deny in decision output", () => {
    const policy: CompiledPolicy = {
      rules: [makeRule({ name: "reject-write", effect: "reject", salience: 50 })],
    };
    const ctx = makeContext({ action: "read" });
    const decision = evaluate(policy, ctx);
    // Won't match because target is "read" action but context action is "read" — should match
    // Actually makeRule defaults to action: "read", so this should match
    expect(decision.effect).toBe("deny");
  });
});
