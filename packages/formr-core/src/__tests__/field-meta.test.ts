import { describe, expect, it } from "vitest";
import { createForm } from "../create-form.js";

describe("field metadata", () => {
  it("isTouched() returns false initially", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    expect(field.isTouched()).toBe(false);
    form.dispose();
  });

  it("isTouched() returns true after markTouched()", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    field.markTouched();
    expect(field.isTouched()).toBe(true);
    form.dispose();
  });

  it("isTouched() returns true after setValue", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    form.setValue("name", "Bob");
    expect(field.isTouched()).toBe(true);
    form.dispose();
  });

  it("isDirty() returns false initially", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    expect(field.isDirty()).toBe(false);
    form.dispose();
  });

  it("isDirty() returns true after changing value", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    form.setValue("name", "Bob");
    expect(field.isDirty()).toBe(true);
    form.dispose();
  });

  it("isDirty() returns false after setting back to initial", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    form.setValue("name", "Bob");
    expect(field.isDirty()).toBe(true);
    form.setValue("name", "Alice");
    expect(field.isDirty()).toBe(false);
    form.dispose();
  });

  it("isValidating() returns false (placeholder)", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    expect(field.isValidating()).toBe(false);
    form.dispose();
  });

  it("markTouched() triggers subscriber notification", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    const field = form.field("name");
    const notifications: unknown[] = [];
    form.subscribe((state) => notifications.push(state.fieldMeta));
    field.markTouched();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      name: { touched: true, isValidating: false, dirty: false, listenerTriggered: false },
    });
    form.dispose();
  });

  it("pipeline rollback does not leave stale touched state", () => {
    const form = createForm({
      initialData: { name: "Alice" },
      middleware: [
        {
          id: "veto-all",
          beforeAction: () => ({ action: "veto" as const, reason: "blocked" }),
        },
      ],
    });
    const field = form.field("name");
    form.setValue("name", "Bob");
    expect(field.isTouched()).toBe(false);
    expect((form.getState().data as Record<string, unknown>).name).toBe("Alice");
    form.dispose();
  });

  it("form-level aggregation: Object.values(state.fieldMeta).some(m => m.touched)", () => {
    const form = createForm({ initialData: { name: "Alice", age: 30 } });
    expect(Object.values(form.getState().fieldMeta).some((m) => m.touched)).toBe(false);
    form.setValue("name", "Bob");
    expect(Object.values(form.getState().fieldMeta).some((m) => m.touched)).toBe(true);
    const meta = form.getState().fieldMeta;
    expect(meta["name"]?.touched).toBe(true);
    expect(meta["age"]).toBeUndefined();
    form.dispose();
  });

  it("isDirty() works with nested objects and arrays", () => {
    const form = createForm({ initialData: { tags: ["a", "b"] } });
    const field = form.field("tags");
    expect(field.isDirty()).toBe(false);

    form.setValue("tags", ["a", "b"]);
    expect(field.isDirty()).toBe(false);

    form.setValue("tags", ["a", "c"]);
    expect(field.isDirty()).toBe(true);

    form.setValue("tags", ["a", "b"]);
    expect(field.isDirty()).toBe(false);
    form.dispose();
  });
});

describe("validation trigger gating", () => {
  function makeValidator() {
    return () => [
      {
        code: "required",
        message: "Required",
        severity: "error" as const,
        path: { namespace: "data" as const, segments: ["name"], canonical: "name" },
        source: { origin: "function-validator" as const, validatorId: "test-validator" },
      },
    ];
  }

  it("onBlur: issues hidden before markTouched, shown after", async () => {
    const form = createForm({
      initialData: { name: "" },
      validators: [makeValidator()],
    });
    const field = form.field("name", { validationTriggers: { onBlur: true } });

    // Submit populates issues in state without setting per-field touched/dirty
    await form.submit();

    // Issues exist in state but gated because field not touched
    expect(field.issues()).toEqual([]);

    // After touch — issues visible
    field.markTouched();
    expect(field.issues().length).toBeGreaterThan(0);
    form.dispose();
  });

  it("onSubmit: issues hidden until form.submit() is called", async () => {
    const form = createForm({
      initialData: { name: "" },
      validators: [makeValidator()],
    });
    const field = form.field("name", { validationTriggers: { onSubmit: true } });

    // Trigger pipeline to populate issues
    form.setValue("name", "x");
    expect(field.issues()).toEqual([]);

    await form.submit();
    expect(field.issues().length).toBeGreaterThan(0);
    form.dispose();
  });

  it("default behavior: issues show after setValue (dirty)", () => {
    const form = createForm({
      initialData: { name: "" },
      validators: [makeValidator()],
    });
    const field = form.field("name");

    // Not dirty yet — issues gated by default onChange trigger
    expect(field.issues()).toEqual([]);

    form.setValue("name", "x");
    expect(field.issues().length).toBeGreaterThan(0);
    form.dispose();
  });

  it("onMount: issues shown immediately after pipeline populates them", async () => {
    const form = createForm({
      initialData: { name: "" },
      validators: [makeValidator()],
    });
    const field = form.field("name", { validationTriggers: { onMount: true } });

    // Submit populates issues without setting per-field dirty/touched
    await form.submit();
    expect(field.issues().length).toBeGreaterThan(0);

    // Compare: without onMount, a fresh untouched/undirty field gates issues
    const field2 = form.field("name", { validationTriggers: { onBlur: true } });
    // field2 is not touched (submit doesn't set per-field touched), so issues are gated
    expect(field2.issues()).toEqual([]);
    form.dispose();
  });

  it("dirty: true is set in pipeline on setValue", () => {
    const form = createForm({ initialData: { name: "Alice" } });
    form.setValue("name", "Bob");
    const meta = form.getState().fieldMeta;
    expect(meta["name"]?.dirty).toBe(true);
    form.dispose();
  });

  it("submitted: true is set on submit", async () => {
    const form = createForm({ initialData: { name: "Alice" } });
    expect(form.getState().meta.submitted).toBeUndefined();
    await form.submit();
    expect(form.getState().meta.submitted).toBe(true);
    form.dispose();
  });
});
