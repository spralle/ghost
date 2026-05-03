import { describe, expect, it } from "bun:test";
import {
  check,
  can,
  filterQuery,
  redact,
  expand,
  type SentinelPrincipal,
  type CheckContext,
} from "../index";
import { compilePolicyRules } from "../policy/compile-policy";
import { GraphSubset } from "../graph/graph-subset";
import { createTuple } from "../graph/relation-tuple";
import { createNode } from "../graph/relation-node";
import { defineResourceSchema } from "../schema/define-resource";
import type { PolicyRule } from "../policy/policy-types";

const principal: SentinelPrincipal = {
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["admin"],
  partyIds: ["party-1", "party-2"],
  orgChain: ["org-root"],
};

const grantRule: PolicyRule = {
  name: "admin-grant",
  effect: "grant",
  target: { kind: "action", action: "read" },
  condition: { "principal.roles": { $in: ["admin"] } },
};

const denyRule: PolicyRule = {
  name: "explicit-deny",
  effect: "deny",
  target: { kind: "action", action: "read" },
  condition: {},
};

function makeContext(rules: readonly PolicyRule[]): CheckContext {
  const policy = compilePolicyRules(rules);
  const graphSubset = new GraphSubset([
    createTuple(createNode("user", "user-1"), "member", createNode("org", "org-root")),
  ]);
  return { policy, graphSubset, resource: { id: "res-1" } };
}

describe("check", () => {
  it("allows when grant rule matches", () => {
    const result = check(principal, "read", makeContext([grantRule]));
    expect(result.effect).toBe("allow");
    expect(result.matchedRules).toHaveLength(1);
    expect(result.matchedRules[0].name).toBe("admin-grant");
  });

  it("denies when no rules match (default deny)", () => {
    const result = check(principal, "write", makeContext([grantRule]));
    expect(result.effect).toBe("deny");
    expect(result.reason).toContain("No matching rules");
  });

  it("denies when deny rule matches", () => {
    const result = check(principal, "read", makeContext([denyRule]));
    expect(result.effect).toBe("deny");
    expect(result.matchedRules).toHaveLength(1);
  });
});

describe("can", () => {
  it("returns boolean", () => {
    expect(can(principal, "read", makeContext([grantRule]))).toBe(true);
    expect(can(principal, "write", makeContext([grantRule]))).toBe(false);
  });
});

interface TestDoc {
  id: string;
  orderLines: { status: string; parties: { serviceProvider: { id: string } } }[];
  owner: { id: string };
}

const testSchema = defineResourceSchema<TestDoc, "read" | "write">({
  name: "TestResource",
  relations: {
    serviceProvider: {
      from: "orderLines",
      $match: { status: "active" },
      $project: "parties.serviceProvider",
    },
    owner: "owner",
  },
  actions: ["read", "write"],
  dataBlocks: {
    core: { fields: ["id", "owner"] },
    lines: { fields: ["orderLines"] },
  },
});

describe("filterQuery", () => {
  it("generates $elemMatch for FilteredRelation", () => {
    const query = filterQuery(testSchema, "serviceProvider", ["party-1"]);
    expect(query).toEqual({
      orderLines: {
        $elemMatch: {
          status: "active",
          "parties.serviceProvider.id": { $in: ["party-1"] },
        },
      },
    });
  });

  it("generates simple ID check for string path relation", () => {
    const query = filterQuery(testSchema, "owner", ["party-1"]);
    expect(query).toEqual({ "owner.id": { $in: ["party-1"] } });
  });
});

describe("redact", () => {
  const doc = { id: "1", owner: { id: "o1" }, orderLines: [{ status: "active", parties: {} }] };

  it("strips fields not in granted blocks", () => {
    const result = redact(doc, testSchema, { grantedBlocks: ["core"] });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("owner");
    expect(result).not.toHaveProperty("orderLines");
  });

  it("includes all fields when all blocks granted", () => {
    const result = redact(doc, testSchema, { grantedBlocks: ["core", "lines"] });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("orderLines");
  });
});

describe("expand", () => {
  it("returns derivation tree with matched rules", () => {
    const tree = expand(principal, "read", makeContext([grantRule]));
    expect(tree.type).toBe("decision");
    expect(tree.description).toContain("allow");
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].type).toBe("rule_match");
  });
});
