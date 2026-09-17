import { beforeEach, describe, expect, it } from "bun:test";
import { buildSnapshot, check, createPrincipal, SnapshotBuildError } from "@ghost/sentinel";
import { MemorySentinelStore } from "../memory-store.js";

describe("MemorySentinelStore", () => {
  let store: MemorySentinelStore;

  beforeEach(() => {
    store = new MemorySentinelStore();
  });

  describe("loadTuples", () => {
    it("returns empty array for empty store", async () => {
      const result = await store.loadTuples("doc", "1", "viewer");
      expect(result).toEqual([]);
    });

    it("returns matching tuples by nodeType, nodeId, and relation", async () => {
      store.addTuple({
        nodeType: "doc",
        nodeId: "1",
        relation: "viewer",
        targetType: "user",
        targetId: "alice",
      });
      store.addTuple({
        nodeType: "doc",
        nodeId: "1",
        relation: "editor",
        targetType: "user",
        targetId: "bob",
      });

      const result = await store.loadTuples("doc", "1", "viewer");
      expect(result).toEqual([
        {
          nodeType: "doc",
          nodeId: "1",
          relation: "viewer",
          targetType: "user",
          targetId: "alice",
        },
      ]);
    });

    it("returns multiple tuples with same key", async () => {
      store.addTuples([
        { nodeType: "doc", nodeId: "1", relation: "viewer", targetType: "user", targetId: "alice" },
        { nodeType: "doc", nodeId: "1", relation: "viewer", targetType: "user", targetId: "bob" },
      ]);

      const result = await store.loadTuples("doc", "1", "viewer");
      expect(result).toHaveLength(2);
    });
  });

  describe("loadTuplesFrom", () => {
    it("returns empty array for empty store", async () => {
      const result = await store.loadTuplesFrom({ type: "doc", id: "1" });
      expect(result).toEqual([]);
    });

    it("returns all tuples from a node regardless of relation", async () => {
      store.addTuples([
        { nodeType: "doc", nodeId: "1", relation: "viewer", targetType: "user", targetId: "alice" },
        { nodeType: "doc", nodeId: "1", relation: "editor", targetType: "user", targetId: "bob" },
        { nodeType: "doc", nodeId: "2", relation: "viewer", targetType: "user", targetId: "carol" },
      ]);

      const result = await store.loadTuplesFrom({ type: "doc", id: "1" });
      expect(result).toHaveLength(2);
    });
  });

  describe("loadPolicies", () => {
    it("returns empty array for unknown resource type", async () => {
      const result = await store.loadPolicies("unknown");
      expect(result).toEqual([]);
    });

    it("returns policies for a resource type", async () => {
      store.addPolicy({ resourceType: "doc", action: "read", condition: { role: "viewer" } });
      store.addPolicy({ resourceType: "doc", action: "write", condition: { role: "editor" } });
      store.addPolicy({ resourceType: "folder", action: "read", condition: null });

      const result = await store.loadPolicies("doc");
      expect(result).toHaveLength(2);
      expect(result[0]?.action).toBe("read");
      expect(result[1]?.action).toBe("write");
    });

    it("preserves stored effects and salience through scoped snapshot evaluation", async () => {
      store.addPolicies([
        { resourceType: "document", action: "read", condition: {}, effect: "grant", salience: 0 },
        { resourceType: "invoice", action: "read", condition: {}, effect: "deny", salience: -1 },
      ]);
      const principal = createPrincipal({
        userId: "alice",
        tenantId: "tenant-1",
        roles: [],
        partyIds: [],
        orgChain: [],
      });
      const snapshot = await buildSnapshot(store, principal, ["document", "invoice"]);
      const evaluate = (type: string) =>
        check(principal, "read", {
          policy: snapshot.compiledPolicy,
          graphSubset: snapshot.graphCone,
          resource: { type },
        });

      expect(evaluate("document").effect).toBe("allow");
      expect(evaluate("invoice").effect).toBe("deny");
      expect(snapshot.compiledPolicy.rules.map((rule) => rule.salience)).toEqual([0, -1]);
    });

    it.each([
      ["Date", new Date(0)],
      ["RegExp", /document/],
      ["Map", new Map()],
      ["malformed $and", { $and: "not-an-array" }],
      ["nested invalid value", { "resource.createdAt": { $eq: new Date(0) } }],
    ])("cannot turn a %s condition into a usable snapshot", async (_label, condition) => {
      store.addPolicy({ resourceType: "document", action: "read", condition });
      const principal = createPrincipal({
        userId: "alice",
        tenantId: "tenant-1",
        roles: [],
        partyIds: [],
        orgChain: [],
      });

      await expect(buildSnapshot(store, principal, ["document"])).rejects.toBeInstanceOf(SnapshotBuildError);
    });
  });

  describe("loadRoles", () => {
    it("returns empty array for unknown principal", async () => {
      const result = await store.loadRoles("unknown");
      expect(result).toEqual([]);
    });

    it("returns roles for a principal", async () => {
      store.setRoles("alice", ["admin", "viewer"]);
      const result = await store.loadRoles("alice");
      expect(result).toEqual(["admin", "viewer"]);
    });
  });

  describe("clear", () => {
    it("removes all data", async () => {
      store
        .addTuple({ nodeType: "doc", nodeId: "1", relation: "viewer", targetType: "user", targetId: "a" })
        .addPolicy({ resourceType: "doc", action: "read", condition: null })
        .setRoles("alice", ["admin"]);

      store.clear();

      expect(await store.loadTuples("doc", "1", "viewer")).toEqual([]);
      expect(await store.loadPolicies("doc")).toEqual([]);
      expect(await store.loadRoles("alice")).toEqual([]);
    });
  });

  describe("fluent API", () => {
    it("supports chaining", () => {
      const result = store
        .addTuple({ nodeType: "doc", nodeId: "1", relation: "viewer", targetType: "user", targetId: "a" })
        .addPolicy({ resourceType: "doc", action: "read", condition: null })
        .setRoles("alice", ["admin"]);

      expect(result).toBe(store);
    });
  });
});
