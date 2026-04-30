import { describe, expect, it } from "vitest";
import type { ContextContribution, ProviderContribution } from "@ghost-shell/contracts/context";
import type { Disposable } from "@ghost-shell/contracts/plugin";
import { createContextContributionRegistry } from "../context-contribution-registry.js";

function makeContribution<T>(
  id: string,
  initialValue: T,
): {
  contribution: ContextContribution<T>;
  setValue: (v: T) => void;
} {
  let value = initialValue;
  const listeners = new Set<() => void>();
  return {
    contribution: {
      id,
      get: () => value,
      subscribe(listener: () => void): Disposable {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
    },
    setValue(v: T) {
      value = v;
      for (const l of listeners) l();
    },
  };
}

function makeProvider(id: string, order: number): ProviderContribution {
  return { id, order, Provider: {} };
}

describe("createContextContributionRegistry", () => {
  describe("contribute and get", () => {
    it("returns undefined for unknown keys", () => {
      const registry = createContextContributionRegistry();
      expect(registry.get("unknown")).toBeUndefined();
    });

    it("stores and retrieves a contribution value", () => {
      const registry = createContextContributionRegistry();
      const { contribution } = makeContribution("theme", "dark");
      registry.contribute(contribution);
      expect(registry.get<string>("theme")).toBe("dark");
    });

    it("reflects updated values from the contribution", () => {
      const registry = createContextContributionRegistry();
      const { contribution, setValue } = makeContribution("count", 0);
      registry.contribute(contribution);
      setValue(42);
      expect(registry.get<number>("count")).toBe(42);
    });

    it("removes contribution on dispose", () => {
      const registry = createContextContributionRegistry();
      const { contribution } = makeContribution("key", "val");
      const disposable = registry.contribute(contribution);
      disposable.dispose();
      expect(registry.get("key")).toBeUndefined();
    });
  });

  describe("subscribe", () => {
    it("notifies listener when a contribution is added", () => {
      const registry = createContextContributionRegistry();
      let called = 0;
      registry.subscribe("key", () => called++);
      const { contribution } = makeContribution("key", "v");
      registry.contribute(contribution);
      expect(called).toBe(1);
    });

    it("notifies listener when a contribution is removed", () => {
      const registry = createContextContributionRegistry();
      const { contribution } = makeContribution("key", "v");
      const disposable = registry.contribute(contribution);
      let called = 0;
      registry.subscribe("key", () => called++);
      disposable.dispose();
      expect(called).toBe(1);
    });

    it("notifies listener when contribution is replaced", () => {
      const registry = createContextContributionRegistry();
      const { contribution: c1 } = makeContribution("key", "a");
      registry.contribute(c1);
      let called = 0;
      registry.subscribe("key", () => called++);
      const { contribution: c2 } = makeContribution("key", "b");
      registry.contribute(c2);
      expect(called).toBe(1);
      expect(registry.get<string>("key")).toBe("b");
    });

    it("stops notifying after dispose", () => {
      const registry = createContextContributionRegistry();
      let called = 0;
      const sub = registry.subscribe("key", () => called++);
      sub.dispose();
      const { contribution } = makeContribution("key", "v");
      registry.contribute(contribution);
      expect(called).toBe(0);
    });
  });

  describe("providers", () => {
    it("returns empty array initially", () => {
      const registry = createContextContributionRegistry();
      expect(registry.getProviders()).toEqual([]);
    });

    it("returns providers sorted by order", () => {
      const registry = createContextContributionRegistry();
      registry.contributeProvider(makeProvider("b", 10));
      registry.contributeProvider(makeProvider("a", 1));
      registry.contributeProvider(makeProvider("c", 5));
      const ids = registry.getProviders().map((p) => p.id);
      expect(ids).toEqual(["a", "c", "b"]);
    });

    it("notifies provider listeners on add", () => {
      const registry = createContextContributionRegistry();
      let called = 0;
      registry.subscribeProviders(() => called++);
      registry.contributeProvider(makeProvider("p", 0));
      expect(called).toBe(1);
    });

    it("notifies provider listeners on remove", () => {
      const registry = createContextContributionRegistry();
      const d = registry.contributeProvider(makeProvider("p", 0));
      let called = 0;
      registry.subscribeProviders(() => called++);
      d.dispose();
      expect(called).toBe(1);
    });

    it("removes provider on dispose", () => {
      const registry = createContextContributionRegistry();
      const d = registry.contributeProvider(makeProvider("p", 0));
      d.dispose();
      expect(registry.getProviders()).toEqual([]);
    });

    it("returns referentially stable array when unchanged", () => {
      const registry = createContextContributionRegistry();
      registry.contributeProvider(makeProvider("p", 0));
      const a = registry.getProviders();
      const b = registry.getProviders();
      expect(a).toBe(b);
    });
  });

  describe("removeByPlugin", () => {
    it("is a no-op for unknown plugin", () => {
      const registry = createContextContributionRegistry();
      registry.removeByPlugin("unknown");
    });

    it("removes context contributions for a plugin", () => {
      const registry = createContextContributionRegistry();
      const { contribution } = makeContribution("key", "val");
      registry.contribute(contribution, "plugin-a");
      expect(registry.get("key")).toBe("val");
      registry.removeByPlugin("plugin-a");
      expect(registry.get("key")).toBeUndefined();
    });

    it("removes provider contributions for a plugin", () => {
      const registry = createContextContributionRegistry();
      registry.contributeProvider(makeProvider("p1", 1), "plugin-a");
      registry.contributeProvider(makeProvider("p2", 2), "plugin-b");
      registry.removeByPlugin("plugin-a");
      const ids = registry.getProviders().map((p) => p.id);
      expect(ids).toEqual(["p2"]);
    });

    it("notifies context listeners on removal", () => {
      const registry = createContextContributionRegistry();
      const { contribution } = makeContribution("key", "val");
      registry.contribute(contribution, "plugin-a");
      let called = 0;
      registry.subscribe("key", () => called++);
      registry.removeByPlugin("plugin-a");
      expect(called).toBe(1);
    });

    it("notifies provider listeners on removal", () => {
      const registry = createContextContributionRegistry();
      registry.contributeProvider(makeProvider("p1", 1), "plugin-a");
      let called = 0;
      registry.subscribeProviders(() => called++);
      registry.removeByPlugin("plugin-a");
      expect(called).toBe(1);
    });
  });
});
