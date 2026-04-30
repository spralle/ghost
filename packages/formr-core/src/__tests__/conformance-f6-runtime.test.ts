import { describe, expect, test } from "vitest";
import { createForm, type FormState, type Middleware, type ValidatorFn } from "../index.js";

/** Trace middleware that records hook invocations in order */
function createTraceMiddleware(): Middleware & { trace: string[] } {
  const trace: string[] = [];
  return {
    id: "trace",
    trace,
    beforeAction() {
      trace.push("beforeAction");
      return { action: "continue" as const };
    },
    afterAction() {
      trace.push("afterAction");
    },
    beforeEvaluate() {
      trace.push("beforeEvaluate");
    },
    afterEvaluate() {
      trace.push("afterEvaluate");
    },
    beforeValidate() {
      trace.push("beforeValidate");
    },
    afterValidate() {
      trace.push("afterValidate");
    },
  };
}

describe("F6: Runtime algorithm conformance", () => {
  test("F6.01: basic set-value action updates state", () => {
    const form = createForm({ initialData: { name: "" } });
    const result = form.setValue("name", "Alice");
    expect(result.ok).toBe(true);
    expect((form.getState().data as Record<string, unknown>).name).toBe("Alice");
    form.dispose();
  });

  test("F6.02: transaction atomicity — error during mutation rolls back", () => {
    // Use a veto hook (beforeAction) that throws to trigger rollback,
    // since notify hooks (beforeEvaluate) now swallow errors for reliability
    const badMiddleware: Middleware = {
      id: "bomb",
      beforeAction() {
        throw new Error("boom");
      },
    };
    const form = createForm({
      initialData: { x: 1 },
      middleware: [badMiddleware],
    });
    const result = form.setValue("x", 2);
    expect(result.ok).toBe(false);
    // State should be unchanged due to rollback
    expect((form.getState().data as Record<string, unknown>).x).toBe(1);
    form.dispose();
  });

  test("F6.03: middleware beforeAction veto rolls back, state unchanged", () => {
    const vetoMiddleware: Middleware = {
      id: "veto",
      beforeAction() {
        return { action: "veto" as const, reason: "denied" };
      },
    };
    const form = createForm({
      initialData: { x: 1 },
      middleware: [vetoMiddleware],
    });
    const result = form.setValue("x", 99);
    expect(result.ok).toBe(false);
    expect((form.getState().data as Record<string, unknown>).x).toBe(1);
    form.dispose();
  });

  test("F6.04: expression evaluation — arbiter rule writes are applied", () => {
    const form = createForm({
      initialData: { name: "", derived: "" },
      arbiterRules: [
        {
          name: "r1",
          when: {},
          then: [{ $set: { derived: "computed" } }],
        },
      ],
    });
    form.setValue("name", "test");
    expect((form.getState().data as Record<string, unknown>).derived).toBe("computed");
    form.dispose();
  });

  test("F6.05: validator issues collected and normalized", () => {
    const validator: ValidatorFn = ({ stage }) => [
      {
        code: "REQUIRED",
        message: "Name is required",
        severity: "error" as const,
        ...(stage !== undefined ? { stage } : {}),
        path: { namespace: "data" as const, segments: ["name"] },
        source: { origin: "function-validator" as const, validatorId: "test-validator" },
      },
    ];
    const form = createForm({
      initialData: { name: "" },
      validators: [validator],
    });
    form.setValue("name", "");
    const issues = form.getState().issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.code).toBe("REQUIRED");
    expect(issues[0]?.severity).toBe("error");
    form.dispose();
  });

  test("F6.06: submit succeeds on valid form", async () => {
    const form = createForm({
      initialData: { name: "Alice" },
      onSubmit: async () => ({ ok: true, submitId: "test-submit" }),
    });
    const result = await form.submit();
    expect(result.ok).toBe(true);
    expect(form.getState().meta.submission?.status).toBe("succeeded");
    form.dispose();
  });

  test("F6.08: submit failure retains validation issues", async () => {
    const validator: ValidatorFn = () => [
      {
        code: "BLOCKED",
        message: "Blocked",
        severity: "error" as const,
        stage: "draft",
        path: { namespace: "data" as const, segments: ["x"] },
        source: { origin: "function-validator" as const, validatorId: "blocker" },
      },
    ];
    const form = createForm({
      initialData: {},
      validators: [validator],
      onSubmit: async () => ({ ok: true, submitId: "s1" }),
    });
    const result = await form.submit();
    expect(result.ok).toBe(false);
    const issues = form.getState().issues;
    expect(issues.some((i) => i.code === "BLOCKED")).toBe(true);
    form.dispose();
  });

  test("F6.09: subscriber notification fires after commit", () => {
    const form = createForm({ initialData: { x: 0 } });
    const notifications: FormState[] = [];
    form.subscribe((state) => {
      notifications.push(state);
    });
    form.setValue("x", 42);
    expect(notifications.length).toBeGreaterThan(0);
    expect((notifications[notifications.length - 1]?.data as Record<string, unknown>).x).toBe(42);
    form.dispose();
  });

  test("F6.10: multiple actions in sequence create separate transactions", () => {
    const trace = createTraceMiddleware();
    const form = createForm({
      initialData: { a: 0, b: 0 },
      middleware: [trace],
    });
    form.setValue("a", 1);
    form.setValue("b", 2);
    // Each action should have its own beforeAction/afterAction pair
    const beforeCount = trace.trace.filter((t) => t === "beforeAction").length;
    const afterCount = trace.trace.filter((t) => t === "afterAction").length;
    expect(beforeCount).toBe(2);
    expect(afterCount).toBe(2);
    form.dispose();
  });

  test("F6.11: structural sharing — unchanged subtrees preserve value equality", () => {
    const form = createForm({ initialData: { a: { nested: 1 }, b: { other: 2 } } });
    const before = form.getState();
    form.setValue("a.nested", 99);
    const after = form.getState();
    // State reference must change after mutation
    expect(after).not.toBe(before);
    // Changed subtree has new value
    expect((after.data as Record<string, unknown>).a).toEqual({ nested: 99 });
    // Unchanged subtree preserves value
    expect((after.data as Record<string, unknown>).b).toEqual({ other: 2 });
    form.dispose();
  });

  test("F6.12: dispose cleans up subscriptions", () => {
    const form = createForm({ initialData: { x: 0 } });
    let callCount = 0;
    form.subscribe(() => {
      callCount++;
    });
    form.setValue("x", 1);
    expect(callCount).toBe(1);
    form.dispose();
    // After dispose, setValue still works but subscriber should not fire
    form.setValue("x", 2);
    expect(callCount).toBe(1);
  });
});
