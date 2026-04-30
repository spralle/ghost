import { describe, expect, it } from "vitest";
import { createInitialShellContextState, setEntityTypeSelection } from "../context-state.js";
import { buildSelectionByEntityType, buildSelectionEnvelope } from "./parts-controller-selection-transition.js";

describe("parts-controller-selection-transition", () => {
  it("buildSelectionByEntityType returns deterministic mapped selections", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = setEntityTypeSelection(state, {
      entityType: "order",
      selectedIds: ["o-1", "o-2"],
      priorityId: "o-2",
    });

    const mapped = buildSelectionByEntityType(state);
    expect(mapped.order?.priorityId).toBe("o-2");
    expect(mapped.order?.selectedIds.join(",")).toBe("o-1,o-2");
  });

  it("buildSelectionEnvelope normalizes ids and includes revision", () => {
    const state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    const envelope = buildSelectionEnvelope(state, {
      selectedPartId: "tab-a",
      selectedPartTitle: "Orders",
      sourceWindowId: "window-a",
      revision: { timestamp: 10, writer: "window-a" },
      selectedPartDefinitionId: "domain.orders",
    });

    expect(envelope.type).toBe("selection");
    expect(envelope.selectedPartInstanceId).toBe("tab-a");
    expect(envelope.selectedPartDefinitionId).toBe("domain.orders");
    expect(envelope.revision?.writer).toBe("window-a");
  });
});
