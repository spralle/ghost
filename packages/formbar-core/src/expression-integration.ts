import { assertSafeSegment } from "@ghost-shell/predicate";
import type { RuleWriteIntent } from "./contracts.js";
import { deleteNestedValue, setNestedValue } from "./nested-utils.js";
import type { FormState } from "./state.js";

/** Arbiter-internal namespace prefixes that should not be written to FormState */
const ARBITER_INTERNAL_PREFIXES = ["$state.", "$meta.", "$contributions."] as const;

/** Check if a path belongs to an arbiter-internal namespace */
export function isArbiterInternalPath(path: string): boolean {
  return ARBITER_INTERNAL_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Apply rule writes to form state (immutable) */
export function applyRuleWrites(
  state: FormState<unknown, unknown>,
  writes: readonly RuleWriteIntent[],
): FormState<unknown, unknown> {
  let data = (state.data ?? {}) as Record<string, unknown>;
  let uiState = (state.uiState ?? {}) as Record<string, unknown>;

  for (const write of writes) {
    if (isArbiterInternalPath(write.path)) continue;

    const isUi = write.path.startsWith("$ui.");
    const dotPath = isUi ? write.path.slice(4) : write.path;
    const segments = dotPath.split(".");

    for (const seg of segments) {
      assertSafeSegment(seg);
    }

    if (write.mode === "delete") {
      if (isUi) {
        uiState = deleteNestedValue(uiState, segments);
      } else {
        data = deleteNestedValue(data, segments);
      }
    } else {
      if (isUi) {
        uiState = setNestedValue(uiState, segments, write.value);
      } else {
        data = setNestedValue(data, segments, write.value);
      }
    }
  }

  return { ...state, data, uiState };
}
