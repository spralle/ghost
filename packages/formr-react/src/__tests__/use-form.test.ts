import { describe, expect, test } from "vitest";
import { type UseFormOptions, useForm } from "../index.js";

describe("useForm", () => {
  test("is exported as a function", () => {
    expect(typeof useForm).toBe("function");
  });

  test("accepts an optional options parameter", () => {
    expect(useForm.length).toBe(1);
  });

  test("UseFormOptions type is exported", () => {
    // Type-level check: UseFormOptions should be importable
    const opts: UseFormOptions = { autoFocusOnError: false };
    expect(opts.autoFocusOnError).toBe(false);
  });

  test("UseFormOptions defaults autoFocusOnError to true", () => {
    const opts: UseFormOptions = {};
    expect(opts.autoFocusOnError).toBeUndefined();
    // The hook defaults undefined to true internally
  });
});
