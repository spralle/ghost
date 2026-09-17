import { describe, expect, it } from "bun:test";
import { check } from "../engine/check.js";
import { createNode } from "../graph/relation-node.js";
import { createPrincipal } from "../principal/sentinel-principal.js";
import { buildSnapshot, SnapshotBuildError } from "../snapshot/snapshot-builder.js";
import { normalizeStoredCondition, STORED_CONDITION_COMPILE_NODE_BUDGET } from "../snapshot/stored-condition.js";
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

function conditionWithSymbol(nested: boolean): Record<string, unknown> {
  const target: Record<string, unknown> = nested ? { $eq: "user-1" } : {};
  Object.defineProperty(target, Symbol("restriction"), {
    value: false,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return nested ? { "principal.userId": target } : target;
}

function conditionWithNonEnumerable(nested: boolean): Record<string, unknown> {
  const target: Record<string, unknown> = nested ? { $eq: "user-1" } : {};
  Object.defineProperty(target, nested ? "$ne" : "principal.userId", {
    value: "user-1",
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return nested ? { "principal.userId": target } : target;
}

function conditionWithGetter(onAccess: () => void, nested: boolean): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  Object.defineProperty(target, nested ? "$eq" : "principal.userId", {
    enumerable: true,
    configurable: true,
    get() {
      onAccess();
      return "user-1";
    },
  });
  return nested ? { "principal.userId": target } : target;
}

function conditionWithSetter(onSet: () => void): Record<string, unknown> {
  const condition: Record<string, unknown> = {};
  Object.defineProperty(condition, "principal.userId", {
    enumerable: true,
    configurable: true,
    set(_value: unknown) {
      onSet();
    },
  });
  return condition;
}

function conditionWithReadonlyData(): Record<string, unknown> {
  const condition: Record<string, unknown> = {};
  Object.defineProperty(condition, "principal.userId", {
    value: "user-1",
    enumerable: true,
    configurable: true,
    writable: false,
  });
  return condition;
}

function createSharedCondition(depth: number): {
  readonly condition: Record<string, unknown>;
  readonly distinctNodes: number;
  readonly operator: { $eq: string };
} {
  const operator = { $eq: "user-1" };
  let condition: Record<string, unknown> = { "principal.userId": operator };
  for (let level = 0; level < depth; level += 1) {
    condition = { $and: [condition, condition] };
  }
  return { condition, distinctNodes: 2 + depth * 2, operator };
}

interface ProxyConditionFixture {
  readonly condition: Record<string, unknown>;
  readonly getterCalls: () => number;
  readonly trapCalls: () => number;
}

function alternatingOwnKeysCondition(nested: boolean): ProxyConditionFixture {
  let getterCount = 0;
  let trapCount = 0;
  const target: Record<string, unknown> = {};
  Object.defineProperty(target, nested ? "$eq" : "principal.userId", {
    configurable: true,
    enumerable: true,
    get() {
      getterCount += 1;
      return "user-1";
    },
  });
  const restriction = Symbol("restriction");
  const proxy = new Proxy(target, {
    ownKeys() {
      trapCount += 1;
      return trapCount % 2 === 1 ? [] : [restriction];
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      return { value: false, enumerable: true, configurable: true, writable: true };
    },
  });
  return {
    condition: nested ? { "principal.userId": proxy } : proxy,
    getterCalls: () => getterCount,
    trapCalls: () => trapCount,
  };
}

function statefulDescriptorCondition(nested: boolean): ProxyConditionFixture {
  let getterCount = 0;
  let trapCount = 0;
  const key = nested ? "$eq" : "principal.userId";
  const target: Record<string, unknown> = {};
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      getterCount += 1;
      return "user-1";
    },
  });
  const proxy = new Proxy(target, {
    ownKeys() {
      trapCount += 1;
      return [key];
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      const value = trapCount % 2 === 0 ? "user-1" : "other-user";
      return { value, enumerable: true, configurable: true, writable: true };
    },
  });
  return {
    condition: nested ? { "principal.userId": proxy } : proxy,
    getterCalls: () => getterCount,
    trapCalls: () => trapCount,
  };
}

function proxiedArrayCondition(): ProxyConditionFixture {
  let trapCount = 0;
  const values = new Proxy(["viewer"], {
    ownKeys(target) {
      trapCount += 1;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      trapCount += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  return {
    condition: { "principal.roles": { $in: values } },
    getterCalls: () => 0,
    trapCalls: () => trapCount,
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

  it.each([
    ["Date", new Date(0)],
    ["RegExp", /document/],
    ["Map", new Map()],
    ["Set", new Set()],
    ["class instance", new (class StoredCondition {})()],
    ["function", () => true],
    ["symbol", Symbol("condition")],
    ["bigint", 1n],
    ["condition array", []],
    ["malformed $and", { $and: "not-an-array" }],
    ["nested Date", { "resource.createdAt": { $eq: new Date(0) } }],
    ["nested unknown operator", { "resource.id": { $unknown: "document-1" } }],
    ["symbol-keyed property", conditionWithSymbol(false)],
    ["nested symbol-keyed property", conditionWithSymbol(true)],
    ["non-enumerable property", conditionWithNonEnumerable(false)],
    ["nested non-enumerable property", conditionWithNonEnumerable(true)],
    ["unsafe readonly descriptor", conditionWithReadonlyData()],
  ])("rejects a %s condition before snapshot creation", async (_label, condition) => {
    const record = { resourceType: "document", action: "read", condition };

    await expect(buildSnapshot(createStore([record]), principal, ["document"])).rejects.toMatchObject({
      name: "SnapshotBuildError",
      code: "invalid-condition",
    });
  });

  it.each([false, true])("rejects accessor descriptors without invoking a getter (nested=%s)", async (nested) => {
    let getterCalls = 0;
    const condition = conditionWithGetter(() => {
      getterCalls += 1;
    }, nested);

    await expect(
      buildSnapshot(createStore([{ resourceType: "document", action: "read", condition }]), principal, ["document"]),
    ).rejects.toBeInstanceOf(SnapshotBuildError);
    expect(getterCalls).toBe(0);
  });

  it("rejects a setter descriptor without invoking it", async () => {
    let setterCalls = 0;
    const condition = conditionWithSetter(() => {
      setterCalls += 1;
    });

    await expect(
      buildSnapshot(createStore([{ resourceType: "document", action: "read", condition }]), principal, ["document"]),
    ).rejects.toBeInstanceOf(SnapshotBuildError);
    expect(setterCalls).toBe(0);
  });

  it.each([
    ["alternating ownKeys", () => alternatingOwnKeysCondition(false)],
    ["nested alternating ownKeys", () => alternatingOwnKeysCondition(true)],
    ["stateful descriptor", () => statefulDescriptorCondition(false)],
    ["nested stateful descriptor", () => statefulDescriptorCondition(true)],
    ["nested proxied array", proxiedArrayCondition],
  ] as const)("rejects a %s Proxy condition with a typed error", async (_label, createFixture) => {
    const fixture = createFixture();

    await expect(
      buildSnapshot(
        createStore([{ resourceType: "document", action: "read", condition: fixture.condition }]),
        principal,
        ["document"],
      ),
    ).rejects.toMatchObject({ name: "SnapshotBuildError", code: "invalid-condition" });
    expect(fixture.trapCalls()).toBeGreaterThan(0);
    expect(fixture.getterCalls()).toBe(0);
  });

  it("rejects cycles with a typed error", async () => {
    const condition: Record<string, unknown> = {};
    condition.self = condition;

    await expect(
      buildSnapshot(createStore([{ resourceType: "document", action: "read", condition }]), principal, ["document"]),
    ).rejects.toBeInstanceOf(SnapshotBuildError);
  });

  it("detaches accepted conditions before snapshot compilation", async () => {
    const operator = { $eq: "user-1" };
    const condition = { "principal.userId": operator };
    const snapshot = await buildSnapshot(
      createStore([{ resourceType: "document", action: "read", condition }]),
      principal,
      ["document"],
    );
    operator.$eq = "other-user";
    delete condition["principal.userId"];
    const bob = createPrincipal({
      userId: "other-user",
      tenantId: "tenant-1",
      roles: [],
      partyIds: [],
      orgChain: [],
    });
    const decide = (subject: typeof principal) =>
      check(subject, "read", {
        policy: snapshot.compiledPolicy,
        graphSubset: snapshot.graphCone,
        resource: { type: "document" },
      }).effect;

    expect(decide(principal)).toBe("allow");
    expect(decide(bob)).toBe("deny");
  });

  it("rejects compact DAGs whose bounded compile expansion exceeds the budget", async () => {
    const fixture = createSharedCondition(20);

    const normalized = normalizeStoredCondition(fixture.condition);

    expect(normalized.ok).toBe(false);
    if (normalized.ok) return;
    expect(normalized.reason).toBe("complexity-budget");
    expect(normalized.complexity).toEqual({
      distinctNodes: fixture.distinctNodes,
      operatorVisits: fixture.distinctNodes,
      expandedNodes: STORED_CONDITION_COMPILE_NODE_BUDGET + 1,
    });
    await expect(
      buildSnapshot(
        createStore([{ resourceType: "document", action: "read", condition: fixture.condition }]),
        principal,
        ["document"],
      ),
    ).rejects.toBeInstanceOf(SnapshotBuildError);
  });

  it("supports an ordinary shared DAG with one visit per node and preserved clone identity", async () => {
    const fixture = createSharedCondition(8);
    const normalized = normalizeStoredCondition(fixture.condition);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.complexity).toEqual({
      distinctNodes: fixture.distinctNodes,
      operatorVisits: fixture.distinctNodes,
      expandedNodes: 1_278,
    });
    const rootBranches = normalized.condition.$and;
    expect(Array.isArray(rootBranches)).toBe(true);
    if (Array.isArray(rootBranches)) expect(rootBranches[0]).toBe(rootBranches[1]);

    const snapshot = await buildSnapshot(
      createStore([{ resourceType: "document", action: "read", condition: fixture.condition }]),
      principal,
      ["document"],
    );
    fixture.operator.$eq = "other-user";
    const bob = createPrincipal({
      userId: "other-user",
      tenantId: "tenant-1",
      roles: [],
      partyIds: [],
      orgChain: [],
    });
    const decide = (subject: typeof principal) =>
      check(subject, "read", {
        policy: snapshot.compiledPolicy,
        graphSubset: snapshot.graphCone,
        resource: { type: "document" },
      }).effect;

    expect(decide(principal)).toBe("allow");
    expect(decide(bob)).toBe("deny");
  });

  it("accepts nested logical, comparison, and array predicate shapes", async () => {
    const condition = {
      $and: [
        { "principal.roles": { $in: ["viewer", "admin"] } },
        { "resource.labels": { $all: ["public"], $size: 1 } },
        { "resource.name": { $regex: "^report", $options: "i" } },
        { $not: { "resource.archived": { $eq: true } } },
      ],
    };

    const snapshot = await buildSnapshot(
      createStore([{ resourceType: "document", action: "read", condition }]),
      principal,
      ["document"],
    );

    expect(snapshot.compiledPolicy.rules[0]?.condition).toEqual({
      $and: [condition, { "resource.type": { $eq: "document" } }],
    });
  });
});
