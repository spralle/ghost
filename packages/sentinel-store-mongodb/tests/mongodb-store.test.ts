import { beforeEach, describe, expect, it } from "bun:test";
import { buildSnapshot, check, createPrincipal, GraphSubset, SnapshotBuildError } from "@ghost/sentinel";
import { BSON, type Collection, type Db } from "mongodb";
import { MongoSentinelStore } from "../src/mongodb-store";

/** Minimal in-memory mock of a MongoDB Collection */
function createMockCollection<T extends Record<string, unknown>>(): Collection<T> {
  let docs: Record<string, unknown>[] = [];

  const col = {
    find(filter: Record<string, unknown>, options?: { projection?: Record<string, unknown> }) {
      const results = docs.filter((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      const mapped =
        options?.projection?._id === 0
          ? results.map((d) => {
              const { _id, ...rest } = d;
              return rest;
            })
          : results;
      return { toArray: () => Promise.resolve(mapped) };
    },
    findOne(filter: Record<string, unknown>, options?: { projection?: Record<string, unknown> }) {
      const found = docs.find((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      if (!found) return Promise.resolve(null);
      if (options?.projection?._id === 0) {
        const { _id, ...rest } = found;
        return Promise.resolve(rest);
      }
      return Promise.resolve(found);
    },
    insertOne(doc: Record<string, unknown>) {
      docs.push(bsonRoundTrip({ _id: Math.random().toString(), ...doc }));
      return Promise.resolve({ insertedId: docs[docs.length - 1]._id });
    },
    insertMany(items: Record<string, unknown>[]) {
      for (const doc of items) {
        docs.push(bsonRoundTrip({ _id: Math.random().toString(), ...doc }));
      }
      return Promise.resolve({ insertedCount: items.length });
    },
    updateOne(
      filter: Record<string, unknown>,
      update: { $set?: Record<string, unknown> },
      options?: { upsert?: boolean },
    ) {
      const idx = docs.findIndex((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      if (idx >= 0 && update.$set) {
        docs[idx] = { ...docs[idx], ...update.$set };
      } else if (idx < 0 && options?.upsert && update.$set) {
        docs.push({ _id: Math.random().toString(), ...update.$set });
      }
      return Promise.resolve({ modifiedCount: idx >= 0 ? 1 : 0 });
    },
    deleteOne(filter: Record<string, unknown>) {
      const idx = docs.findIndex((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      if (idx >= 0) docs.splice(idx, 1);
      return Promise.resolve({ deletedCount: idx >= 0 ? 1 : 0 });
    },
    deleteMany(_filter: Record<string, unknown>) {
      const before = docs.length;
      if (Object.keys(_filter).length === 0) {
        docs = [];
      }
      return Promise.resolve({ deletedCount: before });
    },
    createIndex() {
      return Promise.resolve("ok");
    },
  };

  return col as unknown as Collection<T>;
}

function bsonRoundTrip(document: Record<string, unknown>): Record<string, unknown> {
  return BSON.deserialize(BSON.serialize(document, { ignoreUndefined: false }));
}

function createMockDb(): Db {
  const collections = new Map<string, unknown>();
  return {
    collection<T>(name: string) {
      if (!collections.has(name)) {
        collections.set(name, createMockCollection<T>());
      }
      return collections.get(name);
    },
  } as unknown as Db;
}

describe("MongoSentinelStore", () => {
  let db: Db;
  let store: MongoSentinelStore;

  beforeEach(() => {
    db = createMockDb();
    store = new MongoSentinelStore({ db });
  });

  it("loadTuples returns empty array when no tuples match", async () => {
    expect(await store.loadTuples("user", "u1", "member")).toEqual([]);
  });

  it("loadTuples returns matching tuples filtered by nodeType+nodeId+relation", async () => {
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u1" });
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u2" });
    const result = await store.loadTuples("org", "o1", "member");
    expect(result).toHaveLength(2);
    expect(result[0].targetId).toBe("u1");
  });

  it("loadTuples does NOT return tuples with different relation", async () => {
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "owner", targetType: "user", targetId: "u1" });
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u2" });
    const result = await store.loadTuples("org", "o1", "owner");
    expect(result).toHaveLength(1);
    expect(result[0].targetId).toBe("u1");
  });

  it("loadTuplesFrom returns all tuples for a node", async () => {
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "owner", targetType: "user", targetId: "u1" });
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u2" });
    const result = await store.loadTuplesFrom({ type: "org", id: "o1" });
    expect(result).toHaveLength(2);
  });

  it("loadPolicies returns policies for given resourceType", async () => {
    await store.addPolicy({ resourceType: "document", action: "read", condition: { role: "viewer" } });
    const result = await store.loadPolicies("document");
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("read");
  });

  it("omits undefined optional policy fields before actual BSON serialization", async () => {
    const policy = {
      resourceType: "document",
      action: "read",
      condition: { "resource.id": "document-1" },
      effect: undefined,
      salience: undefined,
    };
    await store.addPolicy(policy);
    const [loaded] = await store.loadPolicies("document");

    expect(Object.hasOwn(loaded, "effect")).toBe(false);
    expect(Object.hasOwn(loaded, "salience")).toBe(false);
    expect(loaded.condition).toEqual({ "resource.id": "document-1" });
    expect(policy.effect).toBeUndefined();
    expect(policy.salience).toBeUndefined();
  });

  it.each([
    ["Date", new Date(0)],
    ["RegExp", /document/],
    ["Map", new Map()],
    ["malformed $and", { $and: "not-an-array" }],
    ["nested invalid value", { "resource.createdAt": { $eq: new Date(0) } }],
  ])("rejects a %s condition before BSON can turn it into a grant", async (_label, condition) => {
    const write = store.addPolicy({ resourceType: "document", action: "read", condition });

    await expect(write).rejects.toBeInstanceOf(SnapshotBuildError);
    expect(await store.loadPolicies("document")).toEqual([]);
  });

  it.each([
    ["Date", new Date(0)],
    ["RegExp", /document/],
    ["nested Date", { "resource.createdAt": { $eq: new Date(0) } }],
  ])("rejects an untrusted %s condition after an actual BSON round trip", async (_label, condition) => {
    await db.collection("sentinel_policies").insertOne({
      resourceType: "document",
      action: "read",
      condition,
    });
    const principal = createPrincipal({ userId: "u1", tenantId: "tenant-1", roles: [], partyIds: [], orgChain: [] });

    await expect(buildSnapshot(store, principal, ["document"])).rejects.toBeInstanceOf(SnapshotBuildError);
  });

  it("preserves resource isolation and decisions after a BSON-backed snapshot round trip", async () => {
    await store.addPolicies([
      { resourceType: "document", action: "read", condition: {}, effect: "grant", salience: 5 },
      { resourceType: "invoice", action: "read", condition: {}, effect: "reject", salience: 4 },
    ]);
    const principal = createPrincipal({ userId: "u1", tenantId: "tenant-1", roles: [], partyIds: [], orgChain: [] });
    const snapshot = await buildSnapshot(store, principal, ["invoice", "document"]);
    const restored = {
      ...snapshot,
      compiledPolicy: JSON.parse(JSON.stringify(snapshot.compiledPolicy)),
      graphCone: new GraphSubset(JSON.parse(JSON.stringify(snapshot.graphCone.tuples))),
    };
    const decide = (type: unknown, current = snapshot) =>
      check(principal, "read", {
        policy: current.compiledPolicy,
        graphSubset: current.graphCone,
        resource: { type },
      }).effect;

    expect(decide("document")).toBe("allow");
    expect(decide("invoice")).toBe("deny");
    expect(decide("other")).toBe("deny");
    expect(decide(["document"])).toBe("deny");
    expect(decide("document", restored)).toBe("allow");
    expect(decide("invoice", restored)).toBe("deny");
  });

  it("loadPolicies returns empty for unknown resourceType", async () => {
    expect(await store.loadPolicies("unknown")).toEqual([]);
  });

  it("loadRoles returns roles for principalId", async () => {
    await store.setRoles("u1", ["admin", "editor"]);
    const roles = await store.loadRoles("u1");
    expect(roles).toEqual(["admin", "editor"]);
  });

  it("loadRoles returns empty array for unknown principalId", async () => {
    expect(await store.loadRoles("unknown")).toEqual([]);
  });

  it("addTuple stores and is retrievable", async () => {
    await store.addTuple({ nodeType: "team", nodeId: "t1", relation: "member", targetType: "user", targetId: "u1" });
    const result = await store.loadTuples("team", "t1", "member");
    expect(result).toHaveLength(1);
  });

  it("addTuples bulk stores multiple", async () => {
    await store.addTuples([
      { nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u1" },
      { nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u2" },
      { nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u3" },
    ]);
    const result = await store.loadTuples("org", "o1", "member");
    expect(result).toHaveLength(3);
  });

  it("removeTuple removes specific tuple", async () => {
    const tuple = { nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u1" };
    await store.addTuple(tuple);
    await store.removeTuple(tuple);
    expect(await store.loadTuples("org", "o1", "member")).toEqual([]);
  });

  it("setRoles upserts (create + update)", async () => {
    await store.setRoles("u1", ["viewer"]);
    expect(await store.loadRoles("u1")).toEqual(["viewer"]);
    await store.setRoles("u1", ["admin"]);
    expect(await store.loadRoles("u1")).toEqual(["admin"]);
  });

  it("removeRoles deletes role document", async () => {
    await store.setRoles("u1", ["admin"]);
    await store.removeRoles("u1");
    expect(await store.loadRoles("u1")).toEqual([]);
  });

  it("clear removes all data", async () => {
    await store.addTuple({ nodeType: "org", nodeId: "o1", relation: "member", targetType: "user", targetId: "u1" });
    await store.addPolicy({ resourceType: "doc", action: "read", condition: {} });
    await store.setRoles("u1", ["admin"]);
    await store.clear();
    expect(await store.loadTuples("org", "o1", "member")).toEqual([]);
    expect(await store.loadPolicies("doc")).toEqual([]);
    expect(await store.loadRoles("u1")).toEqual([]);
  });

  it("write methods return store instance (fluent)", async () => {
    const result = await store.addTuple({ nodeType: "a", nodeId: "b", relation: "c", targetType: "d", targetId: "e" });
    expect(result).toBe(store);
  });
});
