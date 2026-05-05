import type { LayoutNode } from "@formbar/from-schema";

/** Resolved UI state for a single field, driven by arbiter $ui namespace */
export interface ResolvedFieldState {
  readonly visible: boolean;
  readonly readOnly: boolean;
  readonly disabled: boolean;
}

const DEFAULT_FIELD_STATE: ResolvedFieldState = {
  visible: true,
  readOnly: false,
  disabled: false,
};

export { DEFAULT_FIELD_STATE };

/**
 * Build a map of field path → resolved UI state from the arbiter uiState object.
 * Convention: arbiter writes to `$ui.<path>.visible`, `$ui.<path>.readOnly`, `$ui.<path>.disabled`.
 * The uiState on FormState already strips the `$ui.` prefix, so keys are `<path>.visible` etc.
 */
export function resolveFieldStates(
  uiState: Readonly<Record<string, unknown>>,
  fieldPaths: readonly string[],
): ReadonlyMap<string, ResolvedFieldState> {
  const result = new Map<string, ResolvedFieldState>();

  for (const path of fieldPaths) {
    const visible = uiState[`${path}.visible`];
    const readOnly = uiState[`${path}.readOnly`];
    const disabled = uiState[`${path}.disabled`];

    const hasOverride = visible !== undefined || readOnly !== undefined || disabled !== undefined;
    if (!hasOverride) {
      result.set(path, DEFAULT_FIELD_STATE);
      continue;
    }

    result.set(path, {
      visible: visible === undefined ? true : Boolean(visible),
      readOnly: readOnly === undefined ? false : Boolean(readOnly),
      disabled: disabled === undefined ? false : Boolean(disabled),
    });
  }

  return result;
}

/**
 * Prune layout tree nodes where the field's resolved visible state is false.
 * Returns a new tree — does not mutate the input.
 */
export function pruneHiddenFields(
  node: LayoutNode,
  fieldStates: ReadonlyMap<string, ResolvedFieldState>,
): LayoutNode | null {
  // Field nodes: check visibility
  if (node.type === "field" && node.path) {
    const state = fieldStates.get(node.path) ?? DEFAULT_FIELD_STATE;
    return state.visible ? node : null;
  }

  // Non-field nodes: recurse into children
  if (!node.children) return node;

  const filteredChildren: LayoutNode[] = [];
  for (const child of node.children) {
    const pruned = pruneHiddenFields(child, fieldStates);
    if (pruned !== null) {
      filteredChildren.push(pruned);
    }
  }

  return { ...node, children: filteredChildren };
}
