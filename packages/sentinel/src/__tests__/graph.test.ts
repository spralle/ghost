import { describe, it, expect } from "bun:test";
import {
  createNode,
  createTuple,
  GraphSubset,
  buildCone,
} from "../graph/index.js";
import type { SentinelStore } from "../storage/sentinel-store.js";
import type { StoreTuple } from "../storage/sentinel-store.js";

describe("GraphSubset", () => {
  const user = createNode("user", "u1");
  const org = createNode("org", "o1");
  const parentOrg = createNode("org", "o2");
  const rootOrg = createNode("org", "root");

  const tuples = [
    createTuple(user, "member_of", org),
    createTuple(org, "parent", parentOrg),
    createTuple(parentOrg, "parent", rootOrg),
  ];

  it("resolve() returns correct nodes", () => {
    const g = new GraphSubset(tuples);
    const result = g.resolve(user, "member_of");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(org);
  });

  it("resolve() returns empty for unknown relation", () => {
    const g = new GraphSubset(tuples);
    expect(g.resolve(user, "owner")).toHaveLength(0);
  });

  it("transitiveClosure() walks hierarchy", () => {
    const g = new GraphSubset(tuples);
    const result = g.transitiveClosure(org, "parent");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(parentOrg);
    expect(result).toContainEqual(rootOrg);
  });

  it("transitiveClosure() respects maxDepth", () => {
    const g = new GraphSubset(tuples);
    const result = g.transitiveClosure(org, "parent", 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(parentOrg);
  });

  it("transitiveClosure() handles cycles", () => {
    const a = createNode("x", "a");
    const b = createNode("x", "b");
    const cycleTuples = [
      createTuple(a, "link", b),
      createTuple(b, "link", a),
    ];
    const g = new GraphSubset(cycleTuples);
    const result = g.transitiveClosure(a, "link");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(b);
  });

  it("empty graph returns empty results", () => {
    const g = new GraphSubset([]);
    expect(g.tuples).toHaveLength(0);
    expect(g.nodeCount).toBe(0);
    expect(g.resolve(user, "member_of")).toHaveLength(0);
    expect(g.transitiveClosure(user, "member_of")).toHaveLength(0);
  });

  it("nodeCount is correct", () => {
    const g = new GraphSubset(tuples);
    expect(g.nodeCount).toBe(4);
  });
});

describe("buildCone", () => {
  function mockStore(data: Map<string, StoreTuple[]>): SentinelStore {
    return {
      loadTuples: async () => [],
      loadTuplesFrom: async (node) => {
        return data.get(`${node.type}:${node.id}`) ?? [];
      },
      loadPolicies: async () => [],
      loadRoles: async () => [],
    };
  }

  it("collects reachable tuples via BFS", async () => {
    const data = new Map<string, StoreTuple[]>([
      ["user:u1", [{ nodeType: "user", nodeId: "u1", relation: "member_of", targetType: "org", targetId: "o1" }]],
      ["org:o1", [{ nodeType: "org", nodeId: "o1", relation: "parent", targetType: "org", targetId: "o2" }]],
      ["org:o2", []],
    ]);

    const store = mockStore(data);
    const principal = createNode("user", "u1");
    const graph = await buildCone(store, principal);

    expect(graph.tuples).toHaveLength(2);
    expect(graph.nodeCount).toBe(3);
  });

  it("respects maxDepth", async () => {
    const data = new Map<string, StoreTuple[]>([
      ["user:u1", [{ nodeType: "user", nodeId: "u1", relation: "link", targetType: "x", targetId: "a" }]],
      ["x:a", [{ nodeType: "x", nodeId: "a", relation: "link", targetType: "x", targetId: "b" }]],
      ["x:b", [{ nodeType: "x", nodeId: "b", relation: "link", targetType: "x", targetId: "c" }]],
      ["x:c", []],
    ]);

    const store = mockStore(data);
    const graph = await buildCone(store, createNode("user", "u1"), { maxDepth: 1 });
    // depth 0: visit u1 -> find x:a
    expect(graph.tuples).toHaveLength(1);
  });

  it("respects maxNodes", async () => {
    const data = new Map<string, StoreTuple[]>([
      ["user:u1", [
        { nodeType: "user", nodeId: "u1", relation: "link", targetType: "x", targetId: "a" },
        { nodeType: "user", nodeId: "u1", relation: "link", targetType: "x", targetId: "b" },
        { nodeType: "user", nodeId: "u1", relation: "link", targetType: "x", targetId: "c" },
      ]],
      ["x:a", []],
      ["x:b", []],
      ["x:c", []],
    ]);

    const store = mockStore(data);
    // maxNodes=3 means principal + 2 targets max
    const graph = await buildCone(store, createNode("user", "u1"), { maxNodes: 3 });
    expect(graph.nodeCount).toBeLessThanOrEqual(3);
  });
});
