import { describe, expect, test } from "bun:test";

import {
  compilePolicyRules,
  definePolicy,
  evaluatePolicy,
  type EvalContext,
  type PolicyRule,
} from "../policy/index";

function makeContext(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    principal: {
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["member"],
      partyIds: ["party-1"],
      orgChain: ["org-1"],
    },
    resource: {},
    graph: {
      hasRelation: () => false,
    },
    action: "read",
    ...overrides,
  };
}

describe("definePolicy", () => {
  test("freezes config", () => {
    const policy = definePolicy({
      name: "test-policy",
      rules: [
        { name: "r1", effect: "grant", target: { kind: "action", action: "read" }, condition: {} },
      ],
    });

    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.rules)).toBe(true);
  });
});

describe("compilePolicyRules", () => {
  test("sorts by salience descending", () => {
    const rules: PolicyRule[] = [
      { name: "grant-rule", effect: "grant", target: { kind: "action", action: "read" }, condition: {} },
      { name: "deny-rule", effect: "deny", target: { kind: "action", action: "read" }, condition: {} },
      { name: "reject-rule", effect: "reject", target: { kind: "action", action: "read" }, condition: {} },
    ];

    const compiled = compilePolicyRules(rules);

    expect(compiled.rules[0].name).toBe("deny-rule");
    expect(compiled.rules[0].salience).toBe(100);
    expect(compiled.rules[1].name).toBe("reject-rule");
    expect(compiled.rules[1].salience).toBe(50);
    expect(compiled.rules[2].name).toBe("grant-rule");
    expect(compiled.rules[2].salience).toBe(10);
  });

  test("allows manual salience override", () => {
    const rules: PolicyRule[] = [
      { name: "high-grant", effect: "grant", target: { kind: "action", action: "read" }, condition: {}, salience: 200 },
      { name: "deny-rule", effect: "deny", target: { kind: "action", action: "read" }, condition: {} },
    ];

    const compiled = compilePolicyRules(rules);
    expect(compiled.rules[0].name).toBe("high-grant");
    expect(compiled.rules[0].salience).toBe(200);
  });
});

describe("evaluatePolicy", () => {
  test("basic grant rule allows action", () => {
    const compiled = compilePolicyRules([
      { name: "allow-read", effect: "grant", target: { kind: "action", action: "read" }, condition: {} },
    ]);

    const decision = evaluatePolicy(compiled, "read", makeContext());
    expect(decision.effect).toBe("allow");
  });

  test("basic deny rule denies action", () => {
    const compiled = compilePolicyRules([
      { name: "deny-read", effect: "deny", target: { kind: "action", action: "read" }, condition: {} },
    ]);

    const decision = evaluatePolicy(compiled, "read", makeContext());
    expect(decision.effect).toBe("deny");
  });

  test("deny overrides grant via salience", () => {
    const compiled = compilePolicyRules([
      { name: "allow-read", effect: "grant", target: { kind: "action", action: "read" }, condition: {} },
      { name: "deny-read", effect: "deny", target: { kind: "action", action: "read" }, condition: {} },
    ]);

    const decision = evaluatePolicy(compiled, "read", makeContext());
    expect(decision.effect).toBe("deny");
    expect(decision.reason).toContain("deny-read");
  });

  test("reject denies but is different from deny", () => {
    const compiled = compilePolicyRules([
      { name: "reject-read", effect: "reject", target: { kind: "action", action: "read" }, condition: {} },
    ]);

    const decision = evaluatePolicy(compiled, "read", makeContext());
    expect(decision.effect).toBe("deny");
    expect(decision.matchedRules[0].effect).toBe("reject");
  });

  test("condition matching filters rules correctly", () => {
    const compiled = compilePolicyRules([
      {
        name: "grant-admin",
        effect: "grant",
        target: { kind: "action", action: "read" },
        condition: { "principal.roles": { $in: ["admin"] } },
      },
    ]);

    // No admin role - should not match, default deny
    const decision = evaluatePolicy(compiled, "read", makeContext());
    expect(decision.effect).toBe("deny");
    expect(decision.reason).toContain("No matching rules");

    // With admin role - should match
    const adminCtx = makeContext({
      principal: { userId: "u1", tenantId: "t1", roles: ["admin"], partyIds: [], orgChain: [] },
    });
    const decision2 = evaluatePolicy(compiled, "read", adminCtx);
    expect(decision2.effect).toBe("allow");
  });

  test("no matching rules defaults to deny", () => {
    const compiled = compilePolicyRules([
      { name: "grant-write", effect: "grant", target: { kind: "action", action: "write" }, condition: {} },
    ]);

    const decision = evaluatePolicy(compiled, "read", makeContext());
    expect(decision.effect).toBe("deny");
    expect(decision.reason).toContain("No matching rules");
  });
});
