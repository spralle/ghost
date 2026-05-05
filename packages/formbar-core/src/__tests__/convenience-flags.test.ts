import { describe, expect, it } from "vitest";
import type { ValidatorFn } from "../contracts.js";
import { createForm } from "../create-form.js";
import type { ValidationIssue } from "../state.js";

function makeIssue(severity: "error" | "warning"): ValidationIssue {
  return {
    code: "test",
    message: "test",
    severity,
    path: { namespace: "data", segments: ["name"], canonical: "name" },
    source: { origin: "function-validator", validatorId: "v1" },
  };
}

function makeValidator(issues: readonly ValidationIssue[]): ValidatorFn {
  return () => issues;
}

describe("convenience flags", () => {
  it("isPristine() true initially, false after setValue, true after reset", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    expect(form.isPristine()).toBe(true);

    form.setValue("name", "Bob");
    expect(form.isPristine()).toBe(false);

    form.reset();
    expect(form.isPristine()).toBe(true);
    form.dispose();
  });

  it("isDirty() is inverse of isPristine", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    expect(form.isDirty()).toBe(false);

    form.setValue("name", "Bob");
    expect(form.isDirty()).toBe(true);

    form.reset();
    expect(form.isDirty()).toBe(false);
    form.dispose();
  });

  it("isValid() true when no errors, false with errors, true with warnings only", () => {
    const errorForm = createForm({
      initialData: { name: "" },
      validators: [makeValidator([makeIssue("error")])],
    });
    errorForm.setValue("name", "x");
    expect(errorForm.isValid()).toBe(false);
    errorForm.dispose();

    const warnForm = createForm({
      initialData: { name: "" },
      validators: [makeValidator([makeIssue("warning")])],
    });
    warnForm.setValue("name", "x");
    expect(warnForm.isValid()).toBe(true);
    warnForm.dispose();

    const cleanForm = createForm({ initialData: { name: "Alice" } });
    expect(cleanForm.isValid()).toBe(true);
    cleanForm.dispose();
  });

  it("canSubmit() false when invalid, true when valid and not submitting", () => {
    const form = createForm({
      initialData: { name: "" },
      validators: [makeValidator([makeIssue("error")])],
    });
    // Before any pipeline run, no issues in state → valid
    expect(form.canSubmit()).toBe(true);

    // After setValue, pipeline populates error issues
    form.setValue("name", "x");
    expect(form.canSubmit()).toBe(false);
    form.dispose();
  });

  it("isSubmitting() true during submission", async () => {
    let capturedIsSubmitting = false;
    const form = createForm({
      initialData: { name: "Alice" },
      onSubmit: async () => {
        capturedIsSubmitting = form.isSubmitting();
        return { ok: true, submitId: "test" };
      },
    });

    await form.submit();
    expect(capturedIsSubmitting).toBe(true);
    expect(form.isSubmitting()).toBe(false);
    form.dispose();
  });

  it("isTouched() false initially, true after markTouched or setValue", () => {
    const form = createForm({ initialData: { name: "Alice", age: 30 } });
    expect(form.isTouched()).toBe(false);

    form.field("name").markTouched();
    expect(form.isTouched()).toBe(true);

    form.reset();
    expect(form.isTouched()).toBe(false);

    form.setValue("age", 31);
    expect(form.isTouched()).toBe(true);
    form.dispose();
  });
});
