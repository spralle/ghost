import { describe, expect, test } from "vitest";
import {
  descriptionId,
  errorId,
  fieldId,
  findFirstErrorPath,
  getDescriptionProps,
  getErrorProps,
  getFieldProps,
  getLabelProps,
} from "../index.js";

describe("a11y helpers", () => {
  test("fieldId generates deterministic ID from path", () => {
    expect(fieldId("name")).toBe("field-name");
    expect(fieldId("address.city")).toBe("field-address-city");
    expect(fieldId("items[0].name")).toBe("field-items-0-name");
  });

  test("descriptionId derives from fieldId", () => {
    expect(descriptionId("name")).toBe("field-name-description");
  });

  test("errorId derives from fieldId", () => {
    expect(errorId("name")).toBe("field-name-error");
  });

  test("getFieldProps without issues", () => {
    const props = getFieldProps("name");
    expect(props.id).toBe("field-name");
    expect(props["aria-invalid"]).toBeUndefined();
  });

  test("getFieldProps with error issues sets aria-invalid", () => {
    const issues = [
      {
        code: "required",
        message: "Required",
        severity: "error" as const,
        stage: "draft",
        path: { namespace: "data" as const, segments: ["name"] },
        source: { origin: "function-validator" as const, validatorId: "test" },
      },
    ];
    const props = getFieldProps("name", { issues });
    expect(props["aria-invalid"]).toBe(true);
    expect(props["aria-describedby"]).toBe("field-name-error");
  });

  test("getFieldProps with description and errors", () => {
    const issues = [
      {
        code: "required",
        message: "Required",
        severity: "error" as const,
        stage: "draft",
        path: { namespace: "data" as const, segments: ["name"] },
        source: { origin: "function-validator" as const, validatorId: "test" },
      },
    ];
    const props = getFieldProps("name", { issues, hasDescription: true });
    expect(props["aria-describedby"]).toBe("field-name-description field-name-error");
  });

  test("getFieldProps with required", () => {
    const props = getFieldProps("name", { required: true });
    expect(props["aria-required"]).toBe(true);
  });

  test("getLabelProps generates htmlFor", () => {
    expect(getLabelProps("name").htmlFor).toBe("field-name");
  });

  test("getDescriptionProps generates id", () => {
    expect(getDescriptionProps("name").id).toBe("field-name-description");
  });

  test("getErrorProps generates id with alert role", () => {
    const props = getErrorProps("name");
    expect(props.id).toBe("field-name-error");
    expect(props.role).toBe("alert");
  });

  test("findFirstErrorPath returns first error path", () => {
    const issues = [
      {
        code: "required",
        message: "Required",
        severity: "warning" as const,
        stage: "draft",
        path: { namespace: "data" as const, segments: ["email"] },
        source: { origin: "function-validator" as const, validatorId: "test" },
      },
      {
        code: "required",
        message: "Required",
        severity: "error" as const,
        stage: "draft",
        path: { namespace: "data" as const, segments: ["name"] },
        source: { origin: "function-validator" as const, validatorId: "test" },
      },
    ];
    expect(findFirstErrorPath(issues)).toBe("name");
  });

  test("findFirstErrorPath returns undefined when no errors", () => {
    expect(findFirstErrorPath([])).toBeUndefined();
  });

  test("focusFirstError returns false without document", () => {
    const { focusFirstError } = require("../a11y.js");
    expect(focusFirstError([])).toBe(false);
  });
});
