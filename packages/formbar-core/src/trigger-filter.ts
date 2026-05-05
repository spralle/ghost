import type { FieldValidationTriggers } from "./contracts.js";
import type { FieldMetaEntry } from "./state.js";

export interface TriggerContext {
  readonly fieldMeta: FieldMetaEntry | undefined;
  readonly formSubmitted: boolean;
}

/** Default: all issues visible once field is dirty (onChange) */
const DEFAULT_TRIGGERS: FieldValidationTriggers = { onChange: true };

/**
 * Returns true if issues should be visible for this field given its
 * trigger config and current state.
 */
export function shouldShowIssues(triggers: FieldValidationTriggers | undefined, ctx: TriggerContext): boolean {
  const t = triggers ?? DEFAULT_TRIGGERS;
  const hasAnyTrigger = t.onChange || t.onBlur || t.onSubmit || t.onMount;

  // If no triggers configured, default to onChange behavior
  if (!hasAnyTrigger) return ctx.fieldMeta?.dirty ?? false;

  if (t.onMount) return true;
  if (t.onSubmit && ctx.formSubmitted) return true;
  if (t.onBlur && (ctx.fieldMeta?.touched ?? false)) return true;
  if (t.onChange && (ctx.fieldMeta?.dirty ?? false)) return true;
  if (ctx.fieldMeta?.listenerTriggered) return true;

  return false;
}
