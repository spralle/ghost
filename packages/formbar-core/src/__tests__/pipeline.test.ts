import { describe, expect, it, vi } from "vitest";
import type { Middleware, ValidatorFn } from "../contracts.js";
import { createForm } from "../create-form.js";
import type { ValidationIssue } from "../state.js";
import type { TransformDefinition } from "../transforms.js";

function createTracingMiddleware(log: string[]): Middleware {
  return {
    id: "tracer",
    beforeAction: (ctx) => {
      log.push(`beforeAction:${ctx.action.type}`);
      return { action: "continue" };
    },
    afterAction: (ctx) => {
      log.push(`afterAction:${ctx.action.type}`);
    },
    beforeEvaluate: (ctx) => {
      log.push(`beforeEvaluate:${ctx.action.type}`);
    },
    afterEvaluate: (ctx) => {
      log.push(`afterEvaluate:${ctx.action.type}`);
    },
    beforeValidate: (ctx) => {
      log.push(`beforeValidate:${ctx.stage ?? "none"}`);
    },
    afterValidate: (ctx) => {
      log.push(`afterValidate:issues=${ctx.issues.length}`);
    },
    beforeSubmit: (ctx) => {
      log.push(`beforeSubmit:${ctx.submitContext.requestId}`);
      return { action: "continue" };
    },
    afterSubmit: (ctx) => {
      log.push(`afterSubmit:ok=${ctx.result.ok}`);
    },
  };
}

describe("pipeline — 18-step engine", () => {
  it("set-value goes through all middleware hooks in order", () => {
    const log: string[] = [];
    const mw = createTracingMiddleware(log);
    const form = createForm({
      middleware: [mw],
      initialData: { name: "" },
    });

    form.setValue("name", "Alice");

    expect(log).toEqual([
      "beforeAction:set-value",
      "beforeEvaluate:set-value",
      "afterEvaluate:set-value",
      "beforeValidate:none",
      "afterValidate:issues=0",
      "afterAction:set-value",
    ]);
    expect((form.getState().data as Record<string, unknown>).name).toBe("Alice");
  });

  it("middleware beforeAction veto rolls back transaction", () => {
    const vetoMw: Middleware = {
      id: "veto",
      beforeAction: () => ({ action: "veto", reason: "blocked" }),
    };
    const form = createForm({
      middleware: [vetoMw],
      initialData: { name: "original" },
    });

    const result = form.setValue("name", "changed");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("blocked");
    // State unchanged — rollback
    expect((form.getState().data as Record<string, unknown>).name).toBe("original");
  });

  it("middleware beforeSubmit veto rolls back", async () => {
    const vetoMw: Middleware = {
      id: "submit-veto",
      beforeSubmit: () => ({ action: "veto", reason: "not ready" }),
    };
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: "x" });
    const form = createForm({
      middleware: [vetoMw],
      onSubmit,
    });

    const result = await form.submit();

    expect(result.ok).toBe(false);
    expect(result.message).toBe("not ready");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validators produce issues that are normalized and stored", () => {
    const validator: ValidatorFn = ({ stage }) => [
      {
        code: "required",
        message: "Name is required",
        severity: "error",
        ...(stage !== undefined ? { stage } : {}),
        path: { namespace: "data", segments: ["name"] },
        source: { origin: "function-validator", validatorId: "test-validator" },
      },
    ];
    const form = createForm({
      validators: [validator],
      initialData: { name: "" },
    });

    form.setValue("name", "");

    const state = form.getState();
    expect(state.issues.length).toBe(1);
    expect(state.issues[0].code).toBe("required");
  });

  it("expression evaluation runs in the pipeline", () => {
    const form = createForm({
      arbiterRules: [
        {
          name: "r1",
          when: {},
          then: [{ $set: { computed: 42 } }],
        },
      ],
      initialData: { name: "", computed: 0 },
    });

    form.setValue("name", "trigger");

    expect((form.getState().data as Record<string, unknown>).computed).toBe(42);
  });

  it("transform application (ingress + field)", () => {
    const transforms: TransformDefinition[] = [
      {
        id: "trim",
        phase: "ingress",
        transform: (value) => (typeof value === "string" ? value.trim() : value),
      },
      {
        id: "upper",
        phase: "field",
        transform: (value) => (typeof value === "string" ? value.toUpperCase() : value),
      },
    ];
    const form = createForm({
      transforms,
      initialData: { name: "" },
    });

    form.setValue("name", "  hello  ");

    expect((form.getState().data as Record<string, unknown>).name).toBe("HELLO");
  });

  it("submit succeeds and updates meta on success", async () => {
    const form = createForm({
      onSubmit: async () => ({ ok: true, submitId: "test" }),
    });

    const result = await form.submit();

    expect(result.ok).toBe(true);
    expect(form.getState().meta.submission?.status).toBe("succeeded");
  });

  it("full action→commit cycle integration", () => {
    const log: string[] = [];
    const mw = createTracingMiddleware(log);
    const listener = vi.fn();
    const form = createForm({
      middleware: [mw],
      initialData: { x: 0 },
    });
    form.subscribe(listener);

    const result = form.dispatch({ type: "set-value", path: "x", value: 99 });

    expect(result.ok).toBe(true);
    expect((form.getState().data as Record<string, unknown>).x).toBe(99);
    // Subscriber notified (step 16)
    expect(listener).toHaveBeenCalledTimes(1);
    // All hooks fired
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]).toBe("beforeAction:set-value");
    expect(log[log.length - 1]).toBe("afterAction:set-value");
  });

  it("all-or-nothing: error during pipeline rolls back", () => {
    // Use a veto hook (beforeAction) that throws to trigger rollback,
    // since notify hooks (beforeEvaluate) now swallow errors for reliability
    const badMw: Middleware = {
      id: "crasher",
      beforeAction: () => {
        throw new Error("boom");
      },
    };
    const form = createForm({
      middleware: [badMw],
      initialData: { x: "safe" },
    });

    const result = form.setValue("x", "danger");

    expect(result.ok).toBe(false);
    // Throwing veto hook is treated as veto
    expect((form.getState().data as Record<string, unknown>).x).toBe("safe");
  });

  it("multiple middleware run in registration order", () => {
    const log: string[] = [];
    const mw1: Middleware = {
      id: "first",
      beforeAction: () => {
        log.push("first");
        return { action: "continue" };
      },
    };
    const mw2: Middleware = {
      id: "second",
      beforeAction: () => {
        log.push("second");
        return { action: "continue" };
      },
    };
    const form = createForm({
      middleware: [mw1, mw2],
      initialData: { x: 0 },
    });

    form.setValue("x", 1);

    expect(log).toEqual(["first", "second"]);
  });

  it("submit pipeline calls afterSubmit hook", async () => {
    const log: string[] = [];
    const mw = createTracingMiddleware(log);
    const form = createForm({
      middleware: [mw],
      onSubmit: async () => ({ ok: true, submitId: "test" }),
    });

    await form.submit();

    expect(log.some((l) => l.startsWith("beforeSubmit:"))).toBe(true);
    expect(log).toContain("afterSubmit:ok=true");
  });

  it("validator issues block submit", async () => {
    const validator: ValidatorFn = () => [
      {
        code: "required",
        message: "Required",
        severity: "error",
        stage: "draft",
        path: { namespace: "data" as const, segments: ["x"] },
        source: { origin: "function-validator" as const, validatorId: "blocker" },
      },
    ];
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: "x" });
    const form = createForm({
      validators: [validator],
      onSubmit,
    });

    const result = await form.submit();

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Validation failed");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("throws FORMBAR_ASYNC_IN_SYNC_PIPELINE when validator returns Promise in dispatch", () => {
    const asyncValidator: ValidatorFn = () => Promise.resolve([]) as unknown as readonly ValidationIssue[];

    const form = createForm({
      validators: [asyncValidator],
    });

    const result = form.dispatch({ type: "set-value", path: "name", value: "test" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("returned a Promise in synchronous pipeline");
  });

  it("throws FORMBAR_ASYNC_IN_SYNC_PIPELINE when validator returns Promise in validate()", () => {
    const asyncValidator: ValidatorFn = () => Promise.resolve([]) as unknown as readonly ValidationIssue[];

    const form = createForm({
      validators: [asyncValidator],
    });

    expect(() => form.validate()).toThrow("returned a Promise in synchronous validate");
  });
});

describe("pipeline — arbiter write filtering on action path", () => {
  it("filters arbiter writes that target the same path as the user action", () => {
    const form = createForm({
      initialData: { qty: 0, total: 0 },
      arbiterRules: [
        {
          name: "resetQty",
          when: {},
          then: [{ $set: { qty: 0 } }],
        },
      ],
    });
    form.setValue("qty", 10);
    expect((form.getState().data as Record<string, unknown>).qty).toBe(10);
    form.dispose();
  });
});
