import { describe, expect, it } from "vitest";
import { clearChildFieldMeta, shiftFieldMeta, swapFieldMeta } from "../field-meta-shift.js";
import type { FieldMetaEntry } from "../state.js";

const touched: FieldMetaEntry = { touched: true, isValidating: false, dirty: true, listenerTriggered: false };
const clean: FieldMetaEntry = { touched: false, isValidating: false, dirty: false, listenerTriggered: false };

describe("shiftFieldMeta", () => {
  it("remove (delta=-1): drops removed index, shifts subsequent down", () => {
    const meta: Record<string, FieldMetaEntry> = {
      "items.0.name": touched,
      "items.1.name": touched,
      "items.2.name": clean,
    };
    const result = shiftFieldMeta(meta, "items", 1, -1);
    expect(result).toEqual({
      "items.0.name": touched,
      "items.1.name": clean,
    });
  });

  it("insert (delta=+1): shifts at and after index up", () => {
    const meta: Record<string, FieldMetaEntry> = {
      "items.0.name": touched,
      "items.1.name": clean,
    };
    const result = shiftFieldMeta(meta, "items", 1, 1);
    expect(result).toEqual({
      "items.0.name": touched,
      "items.2.name": clean,
    });
  });

  it("preserves non-child keys", () => {
    const meta: Record<string, FieldMetaEntry> = {
      other: touched,
      "items.0": clean,
    };
    const result = shiftFieldMeta(meta, "items", 0, -1);
    expect(result).toEqual({ other: touched });
  });
});

describe("clearChildFieldMeta", () => {
  it("removes all children, preserves others", () => {
    const meta: Record<string, FieldMetaEntry> = {
      "items.0.name": touched,
      "items.1.name": clean,
      other: touched,
    };
    const result = clearChildFieldMeta(meta, "items");
    expect(result).toEqual({ other: touched });
  });
});

describe("swapFieldMeta", () => {
  it("swaps entries for two indices, preserves others", () => {
    const meta: Record<string, FieldMetaEntry> = {
      "items.0.name": touched,
      "items.0.age": clean,
      "items.2.name": clean,
      other: touched,
    };
    const result = swapFieldMeta(meta, "items", 0, 2);
    expect(result).toEqual({
      "items.2.name": touched,
      "items.2.age": clean,
      "items.0.name": clean,
      other: touched,
    });
  });
});
