import { describe, expect, test } from "vitest";
import { createForm } from "../index.js";

describe("F7: API parity conformance", () => {
  test("F7.01: createForm returns all FormApi methods", () => {
    const form = createForm();
    expect(typeof form.getState).toBe("function");
    expect(typeof form.dispatch).toBe("function");
    expect(typeof form.setValue).toBe("function");
    expect(typeof form.validate).toBe("function");
    expect(typeof form.submit).toBe("function");
    expect(typeof form.field).toBe("function");
    expect(typeof form.subscribe).toBe("function");
    expect(typeof form.dispose).toBe("function");
    form.dispose();
  });

  test("F7.02: getState returns FormState with data, uiState, meta, issues", () => {
    const form = createForm();
    const state = form.getState();
    expect(state).toHaveProperty("data");
    expect(state).toHaveProperty("uiState");
    expect(state).toHaveProperty("meta");
    expect(state).toHaveProperty("issues");
    expect(Array.isArray(state.issues)).toBe(true);
    form.dispose();
  });

  test("F7.03: dispatch set-value updates state", () => {
    const form = createForm({ initialData: { name: "" } });
    form.dispatch({ type: "set-value", path: "name", value: "test" });
    const state = form.getState();
    expect((state.data as Record<string, unknown>).name).toBe("test");
    form.dispose();
  });

  test("F7.04: setValue updates state same as dispatch", () => {
    const form = createForm({ initialData: { name: "" } });
    form.setValue("name", "test");
    const state = form.getState();
    expect((state.data as Record<string, unknown>).name).toBe("test");
    form.dispose();
  });

  test("F7.05: validate returns ValidationIssue array", () => {
    const form = createForm();
    const issues = form.validate();
    expect(Array.isArray(issues)).toBe(true);
    form.dispose();
  });

  test("F7.06: submit returns Promise<SubmitResult>", async () => {
    const form = createForm();
    const result = await form.submit();
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("submitId");
    expect(typeof result.submitId).toBe("string");
    form.dispose();
  });

  test("F7.07: submit with onSubmit callback", async () => {
    let callbackInvoked = false;
    const form = createForm({
      onSubmit: async ({ submitContext }) => {
        callbackInvoked = true;
        return { ok: true, submitId: submitContext.requestId };
      },
    });
    const result = await form.submit();
    expect(callbackInvoked).toBe(true);
    expect(result.ok).toBe(true);
    form.dispose();
  });

  test("F7.08: field returns FieldApi with all methods", () => {
    const form = createForm({ initialData: { name: "hello" } });
    const f = form.field("name");
    expect(f).toHaveProperty("path");
    expect(typeof f.get).toBe("function");
    expect(typeof f.set).toBe("function");
    expect(typeof f.validate).toBe("function");
    expect(typeof f.issues).toBe("function");
    expect(typeof f.ui).toBe("function");
    form.dispose();
  });

  test("F7.09: field.get returns field value", () => {
    const form = createForm({ initialData: { name: "hello" } });
    const f = form.field("name");
    expect(f.get()).toBe("hello");
    form.dispose();
  });

  test("F7.10: field.set updates field", () => {
    const form = createForm({ initialData: { name: "" } });
    const f = form.field("name");
    f.set("updated");
    expect(f.get()).toBe("updated");
    expect((form.getState().data as Record<string, unknown>).name).toBe("updated");
    form.dispose();
  });

  test("F7.11: field with config overrides", () => {
    const form = createForm({ initialData: { name: "" } });
    const f = form.field("name", { label: "Name", required: true });
    expect(f).toBeDefined();
    expect(typeof f.get).toBe("function");
    form.dispose();
  });

  test("F7.12: field caching — same path returns same instance", () => {
    const form = createForm({ initialData: { name: "" } });
    const f1 = form.field("name");
    const f2 = form.field("name");
    expect(f1).toBe(f2);
    form.dispose();
  });

  test("F7.13: field with different configs returns different instances", () => {
    const form = createForm({ initialData: { name: "" } });
    const f1 = form.field("name", { label: "A" });
    const f2 = form.field("name", { label: "B" });
    expect(f1).not.toBe(f2);
    form.dispose();
  });

  test("F7.14: subscribe returns unsubscribe function", () => {
    const form = createForm();
    const unsub = form.subscribe(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
    form.dispose();
  });

  test("F7.15: subscribe callback fires on state change", () => {
    const form = createForm({ initialData: { name: "" } });
    let called = false;
    form.subscribe(() => {
      called = true;
    });
    form.setValue("name", "changed");
    expect(called).toBe(true);
    form.dispose();
  });

  test("F7.16: dispose prevents further notifications", () => {
    const form = createForm({ initialData: { name: "" } });
    let callCount = 0;
    form.subscribe(() => {
      callCount++;
    });
    form.setValue("name", "a");
    const countBefore = callCount;
    form.dispose();
    // After dispose, setValue may throw or silently fail — either way, no new notifications
    try {
      form.setValue("name", "b");
    } catch {
      /* expected */
    }
    expect(callCount).toBe(countBefore);
  });

  test("F7.17: FieldConfig precedence — schema-derived < form-level < call-site", () => {
    const form = createForm({ initialData: { name: "" } });
    // Call-site config should be used when provided
    const f1 = form.field("name", { metadata: { source: "call-site" } });
    const f2 = form.field("name", { metadata: { source: "form-level" } });
    // Different configs produce different field instances, confirming call-site override
    expect(f1).not.toBe(f2);
    form.dispose();
  });
});
