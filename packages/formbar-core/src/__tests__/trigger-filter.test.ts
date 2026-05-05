import { describe, expect, it } from "vitest";
import type { FieldMetaEntry } from "../state.js";
import { shouldShowIssues } from "../trigger-filter.js";

function makeMeta(overrides: Partial<FieldMetaEntry> = {}): FieldMetaEntry {
  return {
    touched: overrides.touched ?? false,
    isValidating: overrides.isValidating ?? false,
    dirty: overrides.dirty ?? false,
    listenerTriggered: overrides.listenerTriggered ?? false,
  };
}

describe("shouldShowIssues", () => {
  it("no config → defaults to onChange → shows when dirty", () => {
    expect(shouldShowIssues(undefined, { fieldMeta: makeMeta({ dirty: true }), formSubmitted: false })).toBe(true);
    expect(shouldShowIssues(undefined, { fieldMeta: makeMeta({ dirty: false }), formSubmitted: false })).toBe(false);
  });

  it("{onChange: true} → shows when dirty, hides when not dirty", () => {
    const triggers = { onChange: true };
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ dirty: true }), formSubmitted: false })).toBe(true);
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ dirty: false }), formSubmitted: false })).toBe(false);
  });

  it("{onBlur: true} → shows when touched, hides when not touched", () => {
    const triggers = { onBlur: true };
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ touched: true }), formSubmitted: false })).toBe(true);
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ touched: false }), formSubmitted: false })).toBe(false);
  });

  it("{onSubmit: true} → shows when submitted, hides when not", () => {
    const triggers = { onSubmit: true };
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta(), formSubmitted: true })).toBe(true);
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta(), formSubmitted: false })).toBe(false);
  });

  it("{onMount: true} → always shows", () => {
    const triggers = { onMount: true };
    expect(shouldShowIssues(triggers, { fieldMeta: undefined, formSubmitted: false })).toBe(true);
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta(), formSubmitted: false })).toBe(true);
  });

  it("combined {onChange: true, onBlur: true} → shows if either dirty OR touched", () => {
    const triggers = { onChange: true, onBlur: true };
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ dirty: true }), formSubmitted: false })).toBe(true);
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ touched: true }), formSubmitted: false })).toBe(true);
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta(), formSubmitted: false })).toBe(false);
  });

  it("empty config {} → defaults to onChange behavior", () => {
    expect(shouldShowIssues({}, { fieldMeta: makeMeta({ dirty: true }), formSubmitted: false })).toBe(true);
    expect(shouldShowIssues({}, { fieldMeta: makeMeta({ dirty: false }), formSubmitted: false })).toBe(false);
  });

  it("undefined fieldMeta → treated as not touched/dirty", () => {
    expect(shouldShowIssues(undefined, { fieldMeta: undefined, formSubmitted: false })).toBe(false);
    expect(shouldShowIssues({ onBlur: true }, { fieldMeta: undefined, formSubmitted: false })).toBe(false);
  });

  it("listenerTriggered: true → shows issues regardless of other triggers", () => {
    const triggers = { onBlur: true };
    expect(shouldShowIssues(triggers, { fieldMeta: makeMeta({ listenerTriggered: true }), formSubmitted: false })).toBe(
      true,
    );
  });

  it("listenerTriggered: false → falls through to other trigger checks", () => {
    const triggers = { onBlur: true };
    expect(
      shouldShowIssues(triggers, { fieldMeta: makeMeta({ listenerTriggered: false }), formSubmitted: false }),
    ).toBe(false);
    expect(
      shouldShowIssues(triggers, {
        fieldMeta: makeMeta({ listenerTriggered: false, touched: true }),
        formSubmitted: false,
      }),
    ).toBe(true);
  });
});
