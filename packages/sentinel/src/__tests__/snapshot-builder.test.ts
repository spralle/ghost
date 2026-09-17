import { describe, expect, it } from "bun:test";
import { check } from "../engine/check.js";
import { createNode } from "../graph/relation-node.js";
import { createPrincipal } from "../principal/sentinel-principal.js";
import { buildSnapshot, SnapshotBuildError } from "../snapshot/snapshot-builder.js";
import type { SentinelStore, StoredPolicyRecord } from "../storage/sentinel-store.js";

const principal = createPrincipal({
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["viewer"],
  partyIds: [],
  orgChain: [],
});

function createStore(records: readonly StoredPolicyRecord[]): SentinelStore {
  return {
    async loadTuples() {
      return [];
    },
    async loadTuplesFrom(node) {
      return node.type === "user" && node.id === "user-1"
        ? [{ nodeType: "user", nodeId: "user-1", relation: "member", targetType: "team", targetId: "team-1" }]
        : [];
    },
    async loadPolicies(resourceType) {
      return records.filter((record) => record.resourceType === resourceType || record.resourceType === "mismatch");
    },
    async loadRoles() {
      return ["viewer"];
    },
  };
}

describe("buildSnapshot stored policy ingestion", () => {
  it("preserves exact resource scope, conditions, effects, salience, and user graph traversal", async () => {
    const store = createStore([
      {
        resourceType: "document",
        action: "read",
        effect: "grant",
        salience: 0,
        condition: { "principal.tenantId": "tenant-1", "resource.tenantId": "tenant-1" },
      },
      { resourceType: "invoice", action: "read", effect: "reject", salience: -5, condition: {} },
    ]);

    const snapshot = await buildSnapshot(store, principal, ["invoice", "document"]);
    const context = (resource: Record<string, unknown>) => ({
      policy: snapshot.compiledPolicy,
      graphSubset: snapshot.graphCone,
      resource,
    });

    expect(check(principal, "read", context({ type: "document", tenantId: "tenant-1" })).effect).toBe("allow");
    expect(check(principal, "read", context({ type: "invoice", tenantId: "tenant-1" })).effect).toBe("deny");
    expect(check(principal, "read", context({ type: "document", tenantId: "tenant-2" })).effect).toBe("deny");
    expect(snapshot.graphCone.resolve(createNode("user", "user-1"), "member")).toEqual([createNode("team", "team-1")]);
    expect(snapshot.compiledPolicy.rules.map((rule) => [rule.effect, rule.salience])).toEqual([
      ["grant", 0],
      ["reject", -5],
    ]);
  });

  it("denies missing and non-scalar resource types", async () => {
    const snapshot = await buildSnapshot(
      createStore([{ resourceType: "document", action: "read", condition: {} }]),
      principal,
      ["document"],
    );
    const decision = (type?: unknown) =>
      check(principal, "read", {
        policy: snapshot.compiledPolicy,
        graphSubset: snapshot.graphCone,
        resource: type === undefined ? {} : { type },
      }).effect;

    expect(decision("document")).toBe("allow");
    for (const invalid of [["document"], ["document", "invoice"], 1, true, null, new String("document")]) {
      expect(decision(invalid)).toBe("deny");
    }
    expect(decision()).toBe("deny");
  });

  it.each([
    ["invalid-resource-type", { resourceType: "mismatch", action: "read", condition: {} }],
    ["invalid-action", { resourceType: "document", action: 1, condition: {} }],
    ["invalid-condition", { resourceType: "document", action: "read", condition: null }],
    ["invalid-effect", { resourceType: "document", action: "read", condition: {}, effect: "allow" }],
    ["invalid-salience", { resourceType: "document", action: "read", condition: {}, salience: Number.NaN }],
  ] as const)("rejects %s records with a typed error", async (code, record) => {
    try {
      await buildSnapshot(createStore([record]), principal, ["document"]);
      throw new Error("Expected buildSnapshot to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(SnapshotBuildError);
      if (error instanceof SnapshotBuildError) expect(error.code).toBe(code);
    }
  });
});
