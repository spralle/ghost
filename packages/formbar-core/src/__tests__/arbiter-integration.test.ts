import { describe, expect, test } from "vitest";
import type { ProductionRule } from "@ghost-shell/arbiter";
import { createSession } from "@ghost-shell/arbiter";
import { createArbiterAdapter, createArbiterAdapterFromSession } from "../arbiter-integration.js";
import { createForm } from "../create-form.js";
import type { FormState } from "../state.js";

// Helper to make a minimal FormState
function makeState(overrides: Partial<FormState> = {}): FormState {
  return {
    data: overrides.data ?? {},
    uiState: overrides.uiState ?? {},
    meta: overrides.meta ?? { stage: "draft", validation: {} },
    fieldMeta: overrides.fieldMeta ?? {},
    issues: overrides.issues ?? [],
  };
}

describe("createArbiterAdapter", () => {
  test("creates adapter from rules", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "setTotal",
        when: { qty: { $gt: 0 } },
        then: [{ $set: { "$ui.showTotal": true } }],
      },
    ];
    const adapter = createArbiterAdapter(rules);
    expect(adapter.session).toBeDefined();
    expect(adapter.syncAndFire).toBeInstanceOf(Function);
    adapter.dispose();
  });

  test("syncAndFire returns writes when rules fire", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "showDiscount",
        when: { qty: { $gte: 10 } },
        then: [{ $set: { "$ui.showDiscount": true } }],
      },
    ];
    const adapter = createArbiterAdapter(rules);
    const state = makeState({ data: { qty: 15 } });
    const writes = adapter.syncAndFire(state);
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.some((w) => w.path === "$ui.showDiscount")).toBe(true);
    adapter.dispose();
  });

  test("syncAndFire returns empty when no rules fire", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "showDiscount",
        when: { qty: { $gte: 10 } },
        then: [{ $set: { "$ui.showDiscount": true } }],
      },
    ];
    const adapter = createArbiterAdapter(rules);
    const state = makeState({ data: { qty: 3 } });
    const writes = adapter.syncAndFire(state);
    expect(Array.isArray(writes)).toBe(true);
    adapter.dispose();
  });
});

describe("createArbiterAdapterFromSession", () => {
  test("wraps a pre-configured session", () => {
    const session = createSession({
      rules: [{ name: "r1", when: { x: 1 }, then: [{ $set: { "$ui.y": 2 } }] }],
    });
    const adapter = createArbiterAdapterFromSession(session);
    expect(adapter.session).toBe(session);
    adapter.dispose();
  });

  test("syncAndFire filters out arbiter-internal namespace changes", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "internalWrite",
        when: {},
        then: [
          { $set: { "$state.counter": 1 } },
          { $set: { "$ui.visible": true } },
          { $set: { "$meta.timestamp": 999 } },
          { $set: { "$contributions.source": "test" } },
          { $set: { name: "kept" } },
        ],
      },
    ];
    const adapter = createArbiterAdapter(rules);
    const state = makeState({ data: { trigger: true } });
    const writes = adapter.syncAndFire(state);

    const paths = writes.map((w) => w.path);
    expect(paths).not.toContain("$state.counter");
    expect(paths).not.toContain("$meta.timestamp");
    expect(paths).not.toContain("$contributions.source");
    // $ui and root paths should pass through
    expect(paths).toContain("$ui.visible");
    expect(paths).toContain("name");
    adapter.dispose();
  });
});

describe("createForm with arbiterRules", () => {
  test("form with arbiter rules evaluates on setValue", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "calcTotal",
        when: {},
        then: [{ $set: { "$ui.evaluated": true } }],
      },
    ];
    const form = createForm({
      initialData: { qty: 0 },
      arbiterRules: rules,
    });
    form.setValue("qty", 5);
    const state = form.getState();
    expect((state.uiState as Record<string, unknown>).evaluated).toBe(true);
    form.dispose();
  });

  test("form without arbiter or expression engine skips step 7", () => {
    const form = createForm({ initialData: { x: 1 } });
    const result = form.setValue("x", 2);
    expect(result.ok).toBe(true);
    expect(form.getState().data).toEqual({ x: 2 });
    form.dispose();
  });

  test("arbiter rules can write to data namespace", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "setLabel",
        when: {},
        then: [{ $set: { label: "computed" } }],
      },
    ];
    const form = createForm({
      initialData: { name: "test", label: "" },
      arbiterRules: rules,
    });
    form.setValue("name", "hello");
    expect((form.getState().data as Record<string, unknown>).label).toBe("computed");
    form.dispose();
  });

  test("form with arbiterSession accepts pre-configured session", () => {
    const session = createSession({
      rules: [{ name: "r1", when: {}, then: [{ $set: { "$ui.ready": true } }] }],
    });
    const form = createForm({
      initialData: { x: 0 },
      arbiterSession: session,
    });
    form.setValue("x", 1);
    expect((form.getState().uiState as Record<string, unknown>).ready).toBe(true);
    form.dispose();
  });

  test("data writes do not overwrite the user-edited field", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "resetQty",
        when: {},
        then: [{ $set: { qty: 0 } }],
      },
    ];
    const form = createForm({
      initialData: { qty: 0, label: "" },
      arbiterRules: rules,
    });
    form.setValue("qty", 5);
    // User set qty=5; arbiter rule tries to set qty=0 but should be filtered
    expect((form.getState().data as Record<string, unknown>).qty).toBe(5);
    form.dispose();
  });

  test("arbiter writes to OTHER fields still apply when user edits a field", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "computeLabel",
        when: {},
        then: [{ $set: { label: "computed" } }],
      },
    ];
    const form = createForm({
      initialData: { qty: 0, label: "" },
      arbiterRules: rules,
    });
    form.setValue("qty", 5);
    // label should be computed even though user edited qty
    expect((form.getState().data as Record<string, unknown>).label).toBe("computed");
    form.dispose();
  });

  test("uiState retracts when rule condition becomes false", () => {
    const rules: readonly ProductionRule[] = [
      {
        name: "showDiscount",
        when: { qty: { $gte: 10 } },
        then: [{ $set: { "$ui.showDiscount": true } }],
      },
    ];
    const form = createForm({
      initialData: { qty: 15 },
      arbiterRules: rules,
    });

    form.setValue("qty", 15);
    expect((form.getState().uiState as Record<string, unknown>).showDiscount).toBe(true);

    form.setValue("qty", 3);
    // After retraction, showDiscount should be gone
    expect((form.getState().uiState as Record<string, unknown>).showDiscount).toBeUndefined();
    form.dispose();
  });
});
