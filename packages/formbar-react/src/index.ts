// Re-export core types that React consumers need
export type {
  CreateFormOptions,
  DeepKeys,
  DeepValue,
  FieldApi,
  FieldConfig,
  FormAction,
  FormApi,
  FormDispatchResult,
  FormState,
  SubmitContext,
  SubmitResult,
  ValidationIssue,
  ValidatorFn,
  ValidatorInput,
} from "@formbar/core";
export type { LayoutNode } from "@formbar/from-schema";
export {
  type DescriptionA11yProps,
  descriptionId,
  errorId,
  type FieldA11yProps,
  fieldId,
  findFirstErrorPath,
  focusFirstError,
  getDescriptionProps,
  getErrorProps,
  getFieldProps,
  getLabelProps,
  type LabelA11yProps,
} from "./a11y.js";
export { renderLayoutTree } from "./render-tree.js";
export { RendererRegistry } from "./renderer-registry.js";
export type { FieldAriaAttributes, LayoutRendererProps, NodeRenderer } from "./renderer-types.js";
export {
  ArrayRenderer,
  FieldRenderer,
  GroupRenderer,
  SectionRenderer,
} from "./renderers/index.js";
export type { ResolvedFieldState } from "./resolve-field-state.js";
export { DEFAULT_FIELD_STATE, pruneHiddenFields, resolveFieldStates } from "./resolve-field-state.js";
export { useField } from "./use-field.js";
export { type UseFormOptions, useForm } from "./use-form.js";
export { useFormSelector } from "./use-form-selector.js";
export { type UseSchemaFormOptions, type UseSchemaFormResult, useSchemaForm } from "./use-schema-form.js";
