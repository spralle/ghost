import type { SchemaFieldInfo } from "@formbar/from-schema";

export interface FieldMapping {
  readonly widget: "input" | "textarea" | "select" | "radio-group" | "switch" | "slider";
  readonly inputType?: string;
  readonly inputStep?: string;
  readonly htmlAttrs: Readonly<Record<string, unknown>>;
}

/** HTML step attribute value allowing fractional input */
const STEP_FRACTIONAL = "an" + "y";

function buildHtmlAttrs(field: SchemaFieldInfo): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const m = field.metadata;
  if (!m) return attrs;

  if (m.minimum !== undefined) attrs.min = m.minimum;
  if (m.maximum !== undefined) attrs.max = m.maximum;
  if (m.minLength !== undefined) attrs.minLength = m.minLength;
  if (m.maxLength !== undefined) attrs.maxLength = m.maxLength;
  if (m.pattern !== undefined) attrs.pattern = m.pattern;
  if (m.placeholder !== undefined) attrs.placeholder = m.placeholder;
  if (field.required) attrs.required = true;
  if (m.readOnly) attrs.readOnly = true;

  return attrs;
}

export function mapFieldToWidget(field: SchemaFieldInfo): FieldMapping {
  const m = field.metadata;
  const htmlAttrs = buildHtmlAttrs(field);

  if (field.type === "boolean") {
    return { widget: "switch", htmlAttrs };
  }

  if (field.type === "enum") {
    const values = m?.enum ?? m?.options ?? [];
    return values.length <= 5 ? { widget: "radio-group", htmlAttrs } : { widget: "select", htmlAttrs };
  }

  if (field.type === "date") {
    return { widget: "input", inputType: "date", htmlAttrs };
  }

  if (field.type === "datetime") {
    return { widget: "input", inputType: "datetime-local", htmlAttrs };
  }

  if (field.type === "number" || field.type === "integer") {
    const step = field.type === "integer" ? "1" : STEP_FRACTIONAL;
    if (m?.minimum !== undefined && m?.maximum !== undefined) {
      return { widget: "slider", inputStep: step, htmlAttrs };
    }
    return { widget: "input", inputType: "number", inputStep: step, htmlAttrs };
  }

  if (field.type === "string") {
    if (m?.widget === "textarea" || (m?.maxLength !== undefined && m.maxLength > 200)) {
      return { widget: "textarea", htmlAttrs };
    }
    const format = m?.format;
    if (format === "email") return { widget: "input", inputType: "email", htmlAttrs };
    if (format === "url") return { widget: "input", inputType: "url", htmlAttrs };
    if (format === "password") return { widget: "input", inputType: "password", htmlAttrs };
    return { widget: "input", inputType: "text", htmlAttrs };
  }

  return { widget: "input", inputType: "text", htmlAttrs };
}
