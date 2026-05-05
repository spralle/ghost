import { describe, expect, it } from "vitest";
import type { ValidatorFn } from "../contracts.js";
import { createForm } from "../create-form.js";

function makeValidator(fieldPath: string, code: string): ValidatorFn {
  return () => [
    {
      code,
      message: `${code} error`,
      severity: "error" as const,
      path: { namespace: "data" as const, segments: fieldPath.split("."), canonical: fieldPath },
      source: { origin: "function-validator" as const, validatorId: `validator-${code}` },
    },
  ];
}

describe("onChangeListenTo", () => {
  it("confirmPassword issues become visible when password changes", async () => {
    const form = createForm({
      initialData: { password: "abc", confirmPassword: "xyz" },
      validators: [makeValidator("confirmPassword", "mismatch")],
    });

    const confirm = form.field("confirmPassword", {
      validationTriggers: { onBlur: true, onChangeListenTo: ["password"] },
    });

    // Populate issues via submit (doesn't set per-field touched/dirty)
    await form.submit();

    // Issues gated — field not touched and no listener triggered yet
    expect(confirm.issues()).toEqual([]);

    // Change the source field (password) → triggers listenerTriggered on confirmPassword
    form.setValue("password", "def");

    // Now confirmPassword issues are visible via listenerTriggered
    expect(confirm.issues().length).toBeGreaterThan(0);
    form.dispose();
  });

  it("issues hidden before any trigger fires", async () => {
    const form = createForm({
      initialData: { password: "abc", confirmPassword: "xyz" },
      validators: [makeValidator("confirmPassword", "mismatch")],
    });

    const confirm = form.field("confirmPassword", {
      validationTriggers: { onBlur: true, onChangeListenTo: ["password"] },
    });

    // Populate issues
    await form.submit();

    // No interaction yet — issues hidden
    expect(confirm.issues()).toEqual([]);
    form.dispose();
  });

  it("multiple listeners: two fields listen to the same source", async () => {
    const form = createForm({
      initialData: { source: "a", listenerA: "", listenerB: "" },
      validators: [makeValidator("listenerA", "err-a"), makeValidator("listenerB", "err-b")],
    });

    const fieldA = form.field("listenerA", {
      validationTriggers: { onBlur: true, onChangeListenTo: ["source"] },
    });
    const fieldB = form.field("listenerB", {
      validationTriggers: { onBlur: true, onChangeListenTo: ["source"] },
    });

    await form.submit();
    expect(fieldA.issues()).toEqual([]);
    expect(fieldB.issues()).toEqual([]);

    form.setValue("source", "b");
    expect(fieldA.issues().length).toBeGreaterThan(0);
    expect(fieldB.issues().length).toBeGreaterThan(0);
    form.dispose();
  });
});

describe("onBlurListenTo", () => {
  it("field A issues become visible when source field B is blurred", async () => {
    const form = createForm({
      initialData: { fieldA: "", fieldB: "" },
      validators: [makeValidator("fieldA", "required")],
    });

    const a = form.field("fieldA", {
      validationTriggers: { onBlur: true, onBlurListenTo: ["fieldB"] },
    });
    // Register fieldB so markTouched works
    form.field("fieldB");

    await form.submit();
    expect(a.issues()).toEqual([]);

    // Blur fieldB → triggers listenerTriggered on fieldA
    form.field("fieldB").markTouched();
    expect(a.issues().length).toBeGreaterThan(0);
    form.dispose();
  });
});

describe("reset clears listenerTriggered", () => {
  it("listenerTriggered is false after reset", async () => {
    const form = createForm({
      initialData: { password: "abc", confirmPassword: "xyz" },
      validators: [makeValidator("confirmPassword", "mismatch")],
    });

    form.field("confirmPassword", {
      validationTriggers: { onBlur: true, onChangeListenTo: ["password"] },
    });

    await form.submit();
    form.setValue("password", "def");

    // listenerTriggered should be true
    expect(form.getState().fieldMeta["confirmPassword"]?.listenerTriggered).toBe(true);

    form.reset();

    // After reset, all fieldMeta cleared
    expect(form.getState().fieldMeta["confirmPassword"]).toBeUndefined();
    form.dispose();
  });
});
