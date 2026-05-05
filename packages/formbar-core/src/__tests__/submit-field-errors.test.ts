import { describe, expect, it } from "vitest";
import { createForm } from "../create-form.js";

describe("onSubmit fieldErrors shorthand", () => {
  it("normalizes fieldErrors map into field-targeted ValidationIssues", async () => {
    const form = createForm({
      initialData: { username: "", email: "" },
      onSubmit: async () => ({
        ok: false,
        submitId: "test",
        fieldErrors: { username: "Already taken", email: "Invalid format" },
      }),
    });

    const result = await form.submit();
    expect(result.ok).toBe(false);

    const state = form.getState();
    const usernameIssues = state.issues.filter((i) => i.path.segments[i.path.segments.length - 1] === "username");
    expect(usernameIssues).toHaveLength(1);
    expect(usernameIssues[0]?.message).toBe("Already taken");
    expect(usernameIssues[0]?.code).toBe("SUBMIT_ERROR");
    expect(usernameIssues[0]?.severity).toBe("error");
    expect(usernameIssues[0]?.source.origin).toBe("submit");

    const emailIssues = state.issues.filter((i) => i.path.segments[i.path.segments.length - 1] === "email");
    expect(emailIssues).toHaveLength(1);
    expect(emailIssues[0]?.message).toBe("Invalid format");
  });

  it("merges fieldErrors alongside fieldIssues", async () => {
    const form = createForm({
      initialData: { username: "" },
      onSubmit: async () => ({
        ok: false,
        submitId: "test",
        fieldErrors: { username: "Shorthand error" },
        fieldIssues: [
          {
            code: "FULL_ISSUE",
            message: "Full issue",
            severity: "error" as const,
            path: { namespace: "data", segments: ["email"] },
            source: { origin: "submit" as const, validatorId: "server" },
          },
        ],
      }),
    });

    const result = await form.submit();
    expect(result.ok).toBe(false);

    const state = form.getState();
    expect(state.issues.length).toBeGreaterThanOrEqual(2);

    const shorthand = state.issues.find((i) => i.message === "Shorthand error");
    const full = state.issues.find((i) => i.message === "Full issue");
    expect(shorthand).toBeDefined();
    expect(full).toBeDefined();
  });

  it("works with ok: true (no errors)", async () => {
    const form = createForm({
      initialData: { name: "test" },
      onSubmit: async () => ({ ok: true, submitId: "test" }),
    });

    const result = await form.submit();
    expect(result.ok).toBe(true);
    expect(form.getState().issues).toHaveLength(0);
  });

  it("handles nested field paths in fieldErrors", async () => {
    const form = createForm({
      initialData: { address: { city: "" } },
      onSubmit: async () => ({
        ok: false,
        submitId: "test",
        fieldErrors: { "address.city": "Required" },
      }),
    });

    await form.submit();
    const state = form.getState();
    const cityIssues = state.issues.filter((i) => i.path.segments[i.path.segments.length - 1] === "city");
    expect(cityIssues).toHaveLength(1);
    expect(cityIssues[0]?.message).toBe("Required");
    expect(cityIssues[0]?.path.namespace).toBe("data");
  });
});
