import type { ValidationIssue } from "@formbar/core";

const DEFAULT_FIELD_PREFIX = "field";

/** ARIA props for a form field */
export interface FieldA11yProps {
  readonly id: string;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
  readonly "aria-required"?: boolean;
  readonly "aria-errormessage"?: string;
}

/** Label props for semantic association */
export interface LabelA11yProps {
  readonly htmlFor: string;
}

/** Description/error message props */
export interface DescriptionA11yProps {
  readonly id: string;
  readonly role?: "alert";
}

/** Generate a deterministic field ID from path */
export function fieldId(path: string, prefix: string = DEFAULT_FIELD_PREFIX): string {
  return `${prefix}-${path
    .replace(/[.[\]/]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "")}`;
}

/** Generate description element ID */
export function descriptionId(path: string, prefix?: string): string {
  return `${fieldId(path, prefix)}-description`;
}

/** Generate error element ID */
export function errorId(path: string, prefix?: string): string {
  return `${fieldId(path, prefix)}-error`;
}

/** Get ARIA props for a field input element */
export function getFieldProps(
  path: string,
  options?: {
    readonly issues?: readonly ValidationIssue[];
    readonly required?: boolean;
    readonly hasDescription?: boolean;
  },
): FieldA11yProps {
  const id = fieldId(path);
  const hasErrors = options?.issues?.some((i) => i.severity === "error") ?? false;

  const describedBy: string[] = [];
  if (options?.hasDescription) describedBy.push(descriptionId(path));
  if (hasErrors) describedBy.push(errorId(path));

  const props: FieldA11yProps = {
    id,
    ...(hasErrors ? { "aria-invalid": true as const } : {}),
    ...(describedBy.length > 0 ? { "aria-describedby": describedBy.join(" ") } : {}),
    ...(options?.required ? { "aria-required": true as const } : {}),
    ...(hasErrors ? { "aria-errormessage": errorId(path) } : {}),
  };

  return props;
}

/** Get label props for semantic association */
export function getLabelProps(path: string): LabelA11yProps {
  return { htmlFor: fieldId(path) };
}

/** Get description element props */
export function getDescriptionProps(path: string): DescriptionA11yProps {
  return { id: descriptionId(path) };
}

/** Get error message props */
export function getErrorProps(path: string): DescriptionA11yProps {
  return { id: errorId(path), role: "alert" };
}

/** Find the first field path with errors (for focus management) */
export function findFirstErrorPath(issues: readonly ValidationIssue[]): string | undefined {
  const firstError = issues.find((i) => i.severity === "error");
  if (!firstError) return undefined;
  return firstError.path.segments.join(".");
}

/** Focus the first error field after submit (browser-only) */
export function focusFirstError(issues: readonly ValidationIssue[]): boolean {
  const path = findFirstErrorPath(issues);
  if (!path) return false;

  if (typeof document === "undefined") return false;

  const id = fieldId(path);
  const element = document.getElementById(id);
  if (element) {
    element.focus();
    return true;
  }
  return false;
}
