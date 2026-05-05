import { describe, expect, it, vi } from "vitest";
import type { Middleware, ValidatorFn } from "../contracts.js";
import { createForm } from "../create-form.js";
import { FormbarError } from "../errors.js";
import { runVetoHooksSync } from "../middleware-runner.js";
import type { ValidationIssue } from "../state.js";
import type { TransformDefinition } from "../transforms.js";

describe("armada-8vrp: async middleware in sync pipeline throws", () => {
  it("runVetoHooksSync throws FORMBAR_ASYNC_IN_SYNC_PIPELINE when hook returns a Promise", () => {
    const mw: Middleware = {
      id: "async-mw",
      beforeAction: () => Promise.resolve({ action: "continue" as const }),
    };

    expect(() => runVetoHooksSync([mw], "beforeAction", {})).toThrow(FormbarError);
    try {
      runVetoHooksSync([mw], "beforeAction", {});
    } catch (err) {
      expect(err).toBeInstanceOf(FormbarError);
      expect((err as FormbarError).code).toBe("FORMBAR_ASYNC_IN_SYNC_PIPELINE");
    }
  });

  it("pipeline dispatch fails when async middleware used in sync path", () => {
    const asyncMw: Middleware = {
      id: "async-veto",
      beforeAction: () => Promise.resolve({ action: "continue" as const }),
    };
    const form = createForm({
      middleware: [asyncMw],
      initialData: { x: 1 },
    });

    // The pipeline catches the error and returns it
    const result = form.setValue("x", 2);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("returned a Promise");
  });
});

describe("armada-xmj3: form.validate() returns actual issues", () => {
  function createRequiredValidator(): ValidatorFn {
    return (input) => {
      const data = input.data as Record<string, unknown>;
      const issues: ValidationIssue[] = [];
      if (!data.name) {
        issues.push({
          code: "required",
          message: "Name is required",
          severity: "error",
          ...(input.stage !== undefined ? { stage: input.stage } : {}),
          path: { namespace: "data", segments: ["name"] },
          source: { origin: "function-validator", validatorId: "required-name" },
        });
      }
      return issues;
    };
  }

  it("validate() returns issues from registered validators", () => {
    const form = createForm({
      validators: [createRequiredValidator()],
      initialData: { name: "" },
    });

    const issues = form.validate();
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("required");
    expect(issues[0].message).toBe("Name is required");
  });

  it("validate() returns empty when data is valid", () => {
    const form = createForm({
      validators: [createRequiredValidator()],
      initialData: { name: "Alice" },
    });

    const issues = form.validate();
    expect(issues).toEqual([]);
  });

  it("validate(stage) scopes validation to given stage", () => {
    const stageValidator: ValidatorFn = (input) => {
      if (input.stage === "submit") {
        return [
          {
            code: "submit-only",
            message: "Only on submit",
            severity: "error",
            stage: input.stage,
            path: { namespace: "data", segments: ["x"] },
            source: { origin: "function-validator", validatorId: "stage-check" },
          },
        ];
      }
      return [];
    };

    const form = createForm({
      validators: [stageValidator],
      initialData: {},
    });

    expect(form.validate("draft")).toEqual([]);
    expect(form.validate("submit").length).toBe(1);
    expect(form.validate("submit")[0].code).toBe("submit-only");
  });

  it("validate() returns empty when no validators registered", () => {
    const form = createForm({ initialData: {} });
    expect(form.validate()).toEqual([]);
  });
});

describe("armada-15da: submit applies egress transforms", () => {
  it("onSubmit receives egress-transformed data", async () => {
    const egressTransform: TransformDefinition = {
      id: "uppercase-name",
      phase: "egress",
      transform: (value: unknown) => {
        const data = value as Record<string, unknown>;
        return { ...data, name: String(data.name).toUpperCase() };
      },
    };

    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: "test-1" });

    const form = createForm({
      transforms: [egressTransform],
      initialData: { name: "alice" },
      onSubmit,
    });

    await form.submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0].payload;
    expect(payload).toEqual({ name: "ALICE" });
  });

  it("submit without transforms passes raw data", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: "test-2" });

    const form = createForm({
      initialData: { name: "bob" },
      onSubmit,
    });

    await form.submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0].payload;
    expect(payload).toEqual({ name: "bob" });
  });
});
