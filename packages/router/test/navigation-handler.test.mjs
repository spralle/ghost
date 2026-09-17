import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_MODIFIER_MAP } from "../dist/dom/link-types.js";
import { resolveModifiers } from "../dist/dom/navigation-handler.js";

function mockMouseEvent(overrides = {}) {
  return {
    button: 0,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    altKey: false,
    preventDefault() {},
    stopPropagation() {},
    ...overrides,
  };
}

describe("resolveModifiers", () => {
  it("no modifiers returns plain (auto)", () => {
    const event = mockMouseEvent();
    const result = resolveModifiers(event, DEFAULT_MODIFIER_MAP);
    assert.equal(result, "auto");
  });

  it("ctrl key retains automatic placement", () => {
    const event = mockMouseEvent({ ctrlKey: true });
    const result = resolveModifiers(event, DEFAULT_MODIFIER_MAP);
    assert.equal(result, "auto");
  });

  it("ctrl+shift returns split", () => {
    const event = mockMouseEvent({ ctrlKey: true, shiftKey: true });
    const result = resolveModifiers(event, DEFAULT_MODIFIER_MAP);
    assert.equal(result, "split");
  });

  it("shift returns detached placement", () => {
    const event = mockMouseEvent({ shiftKey: true });
    const result = resolveModifiers(event, DEFAULT_MODIFIER_MAP);
    assert.equal(result, "detach");
  });

  it("middle button returns background placement", () => {
    const event = mockMouseEvent({ button: 1 });
    const result = resolveModifiers(event, DEFAULT_MODIFIER_MAP);
    assert.equal(result, "background");
  });

  it("custom modifier map overrides defaults", () => {
    const customMap = {
      plain: "replace",
      ctrl: "split",
      ctrlShift: "window",
      shift: "tab",
      middle: "auto",
    };
    assert.equal(resolveModifiers(mockMouseEvent(), customMap), "replace");
    assert.equal(resolveModifiers(mockMouseEvent({ ctrlKey: true }), customMap), "split");
    assert.equal(resolveModifiers(mockMouseEvent({ button: 1 }), customMap), "auto");
  });
});
