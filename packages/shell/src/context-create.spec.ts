import { describe, expect, it, vi } from "vitest";
import { createContextForToken } from "./context-create.js";
import { createState, isManagedState } from "./reactive-state.js";

/** Minimal token shape matching ContextToken<T> */
function makeToken<T>(id: string, schema?: { safeParse(v: unknown): { success: boolean; error?: { message: string } } }) {
  return Object.freeze({ id, schema, __type: undefined as unknown as T });
}

describe("createContextForToken", () => {
  function mockContribute() {
    const contributions: Array<{ id: string; get(): unknown; subscribe(l: () => void): { dispose(): void } }> = [];
    const contribute = (c: (typeof contributions)[0]) => {
      contributions.push(c);
      return { dispose: vi.fn() };
    };
    return { contribute, contributions };
  }

  it("creates a managed state proxy and registers contribution", () => {
    const token = makeToken<{ count: number }>("test.counter");
    const { contribute, contributions } = mockContribute();

    const result = createContextForToken(token, { count: 0 }, contribute);

    expect(isManagedState(result.state)).toBe(true);
    expect(contributions).toHaveLength(1);
    expect(contributions[0].id).toBe("test.counter");
    expect(contributions[0].get()).toEqual({ count: 0 });

    result.dispose();
  });

  it("wraps existing managed proxy without creating a new one", () => {
    const token = makeToken<{ value: string }>("test.existing");
    const existing = createState({ value: "hello" });
    const { contribute } = mockContribute();

    const result = createContextForToken(token, existing, contribute);

    expect(result.state).toBe(existing);
    // dispose should NOT dispose the externally-owned proxy
    result.dispose();
    expect(isManagedState(existing)).toBe(true);
  });

  it("validates against token schema on creation", () => {
    // Mock a Zod-like schema
    const schema = {
      safeParse: (val: unknown) => ({
        success: false,
        error: { message: "String must contain at least 1 character(s)" },
      }),
    };
    const token = makeToken("test.validated", schema as never);
    const { contribute } = mockContribute();

    expect(() => createContextForToken(token, { name: "" } as never, contribute)).toThrow(
      /Context "test.validated" init failed validation/,
    );
  });

  it("subscription notifies on state mutation", async () => {
    const token = makeToken<{ x: number }>("test.sub");
    const { contribute, contributions } = mockContribute();

    const result = createContextForToken(token, { x: 1 }, contribute);
    const listener = vi.fn();
    contributions[0].subscribe(listener);

    result.state.x = 2;
    // valtio notifies async
    await Promise.resolve();
    expect(listener).toHaveBeenCalled();

    result.dispose();
  });

  it("dispose unregisters contribution and disposes state", () => {
    const token = makeToken<{ a: number }>("test.dispose");
    const disposeFn = vi.fn();
    const contribute = () => ({ dispose: disposeFn });

    const result = createContextForToken(token, { a: 1 }, contribute);
    result.dispose();

    expect(disposeFn).toHaveBeenCalled();
    expect(isManagedState(result.state)).toBe(false);
  });
});
