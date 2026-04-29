import { describe, it, expect } from "vitest";

const tick = () => new Promise((r) => setTimeout(r, 10));
import { createState, subscribeState, getStateSnapshot, disposeState, isManagedState, proxyMap } from "./reactive-state";

describe("createState", () => {
  it("returns a mutable proxy with same shape", () => {
    const state = createState({ count: 0, name: "test" });
    expect(state.count).toBe(0);
    expect(state.name).toBe("test");

    state.count = 5;
    expect(state.count).toBe(5);
  });

  it("is recognized as managed state", () => {
    const state = createState({ x: 1 });
    expect(isManagedState(state)).toBe(true);
    expect(isManagedState({})).toBe(false);
  });
});

describe("subscribeState", () => {
  it("fires on property mutation with path info", async () => {
    const state = createState({ count: 0 });
    const ops: unknown[] = [];
    subscribeState(state, (o) => ops.push(...o));

    state.count = 42;

    await tick();

    expect(ops.length).toBeGreaterThan(0);
    const [op, path, value] = ops[0] as [string, string[], unknown];
    expect(op).toBe("set");
    expect(path).toContain("count");
    expect(value).toBe(42);
  });

  it("batches multiple mutations in one microtask", async () => {
    const state = createState({ a: 0, b: 0 });
    let callCount = 0;
    subscribeState(state, () => { callCount++; });

    state.a = 1;
    state.b = 2;

    await tick();

    expect(callCount).toBe(1);
  });

  it("throws on non-managed object", () => {
    expect(() => subscribeState({}, () => {})).toThrow("non-managed state");
  });
});

describe("getStateSnapshot", () => {
  it("returns immutable copy of current state", () => {
    const state = createState({ value: "hello" });
    const snap = getStateSnapshot(state);
    expect(snap.value).toBe("hello");

    expect(() => { (snap as { value: string }).value = "mutated"; }).toThrow();
  });
});

describe("disposeState", () => {
  it("stops notifications after dispose", async () => {
    const state = createState({ x: 0 });
    const ops: unknown[] = [];
    subscribeState(state, (o) => ops.push(...o));

    disposeState(state);
    state.x = 99;

    await tick();
    expect(ops.length).toBe(0);
    expect(isManagedState(state)).toBe(false);
  });
});

describe("proxyMap support", () => {
  it("detects Map mutations", async () => {
    const state = createState({ items: proxyMap<string, number>() });
    const ops: unknown[] = [];
    subscribeState(state, (o) => ops.push(...o));

    state.items.set("a", 1);

    await tick();
    expect(ops.length).toBeGreaterThan(0);
  });
});
