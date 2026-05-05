import type { ProductionRule } from "@ghost-shell/arbiter";
import { describe, expect, test } from "vitest";
import { createForm } from "../create-form.js";

/**
 * Reproduction test for demo 18 (arbiter visibility).
 * Uses the exact same rules and initial state as the demo component
 * to verify core logic works end-to-end through createForm.
 */

interface FormData {
  readonly country: string;
  readonly state: string;
  readonly province: string;
  readonly region: string;
}

interface UiState {
  readonly showState: boolean;
  readonly showProvince: boolean;
}

const arbiterRules: readonly ProductionRule[] = [
  {
    name: "showUSState",
    when: { country: "US" },
    then: [{ $set: { "$ui.showState": true, "$ui.showProvince": false } }],
  },
  {
    name: "showCAProvince",
    when: { country: "CA" },
    then: [{ $set: { "$ui.showState": false, "$ui.showProvince": true } }],
  },
  {
    name: "hideRegional",
    when: { country: { $nin: ["US", "CA"] } },
    then: [{ $set: { "$ui.showState": false, "$ui.showProvince": false } }],
  },
];

function makeForm() {
  return createForm<FormData, UiState>({
    initialData: { country: "", state: "", province: "", region: "" },
    initialUiState: { showState: false, showProvince: false },
    arbiterRules,
  });
}

describe("demo 18 arbiter visibility — direct state", () => {
  test("initial state: both hidden", () => {
    const form = makeForm();
    const { uiState } = form.getState();
    expect(uiState.showState).toBe(false);
    expect(uiState.showProvince).toBe(false);
    form.dispose();
  });

  test("select US: showState=true, showProvince=false", () => {
    const form = makeForm();
    form.setValue("country", "US");
    const { uiState } = form.getState();
    expect(uiState.showState).toBe(true);
    expect(uiState.showProvince).toBe(false);
    form.dispose();
  });

  test("switch US → CA: showState=false, showProvince=true", () => {
    const form = makeForm();
    form.setValue("country", "US");
    form.setValue("country", "CA");
    const { uiState } = form.getState();
    expect(uiState.showState).toBe(false);
    expect(uiState.showProvince).toBe(true);
    form.dispose();
  });

  test("switch CA → UK: both hidden", () => {
    const form = makeForm();
    form.setValue("country", "US");
    form.setValue("country", "CA");
    form.setValue("country", "UK");
    const { uiState } = form.getState();
    expect(uiState.showState).toBe(false);
    expect(uiState.showProvince).toBe(false);
    form.dispose();
  });

  test("switch UK → US: showState=true again", () => {
    const form = makeForm();
    form.setValue("country", "US");
    form.setValue("country", "CA");
    form.setValue("country", "UK");
    form.setValue("country", "US");
    const { uiState } = form.getState();
    expect(uiState.showState).toBe(true);
    expect(uiState.showProvince).toBe(false);
    form.dispose();
  });

  test("select empty string: both hidden", () => {
    const form = makeForm();
    form.setValue("country", "US");
    form.setValue("country", "");
    const { uiState } = form.getState();
    expect(uiState.showState).toBe(false);
    expect(uiState.showProvince).toBe(false);
    form.dispose();
  });
});

describe("demo 18 arbiter visibility — subscription", () => {
  test("subscriber sees correct uiState after each setValue", () => {
    const form = makeForm();
    const snapshots: UiState[] = [];
    form.subscribe(() => {
      snapshots.push({ ...form.getState().uiState });
    });

    form.setValue("country", "US");
    const afterUS = snapshots[snapshots.length - 1];
    expect(afterUS.showState).toBe(true);
    expect(afterUS.showProvince).toBe(false);

    form.setValue("country", "CA");
    const afterCA = snapshots[snapshots.length - 1];
    expect(afterCA.showState).toBe(false);
    expect(afterCA.showProvince).toBe(true);

    form.setValue("country", "UK");
    const afterUK = snapshots[snapshots.length - 1];
    expect(afterUK.showState).toBe(false);
    expect(afterUK.showProvince).toBe(false);

    form.setValue("country", "US");
    const afterUS2 = snapshots[snapshots.length - 1];
    expect(afterUS2.showState).toBe(true);
    expect(afterUS2.showProvince).toBe(false);

    form.setValue("country", "");
    const afterEmpty = snapshots[snapshots.length - 1];
    expect(afterEmpty.showState).toBe(false);
    expect(afterEmpty.showProvince).toBe(false);

    form.dispose();
  });

  test("subscriber receives notifications for every transition", () => {
    const form = makeForm();
    let callCount = 0;
    form.subscribe(() => {
      callCount++;
    });

    form.setValue("country", "US");
    form.setValue("country", "CA");
    form.setValue("country", "UK");

    // Each setValue should trigger at least one notification
    expect(callCount).toBeGreaterThanOrEqual(3);
    form.dispose();
  });
});
