import { describe, expect, it } from "vitest";
import {
  createDndDiagnosticEnvelope,
  type DndDiagnosticEvent,
  emitDndAbort,
  emitDndCommit,
  emitDndDiagnostic,
  emitDndReject,
  emitDndStart,
} from "./dnd-diagnostics.js";

function createEvent(overrides?: Partial<DndDiagnosticEvent>): DndDiagnosticEvent {
  return {
    outcome: "start",
    path: "same-window",
    reason: "spec-test",
    sourceWindowId: "win-a",
    targetWindowId: "win-a",
    tabId: "tab-1",
    correlation: {
      transferId: "transfer-1",
      operationId: "operation-1",
    },
    ...overrides,
  };
}

describe("dnd-diagnostics", () => {
  it("diagnostic envelope includes timestamp and preserves shape", () => {
    const event = createEvent({ outcome: "commit" });
    const envelope = createDndDiagnosticEnvelope(event);

    expect(envelope.outcome).toBe("commit");
    expect(envelope.path).toBe("same-window");
    expect(envelope.reason).toBe("spec-test");
    expect(envelope.sourceWindowId).toBe("win-a");
    expect(envelope.targetWindowId).toBe("win-a");
    expect(envelope.tabId).toBe("tab-1");
    expect(envelope.correlation?.transferId).toBe("transfer-1");
    expect(envelope.correlation?.operationId).toBe("operation-1");
    expect(envelope.at).toContain("T");
  });

  it("diagnostic emitter stores last diagnostic and returns envelope", () => {
    const runtime = {
      lastDndDiagnostic: null,
    } as {
      lastDndDiagnostic: ReturnType<typeof createDndDiagnosticEnvelope> | null;
    };

    const envelope = emitDndDiagnostic(
      runtime,
      createEvent({
        outcome: "reject",
        path: "cross-window-bridge",
        reason: "cross-window-out-of-scope",
        targetWindowId: "win-b",
      }),
    );

    expect(runtime.lastDndDiagnostic).toBe(envelope);
    expect(envelope.outcome).toBe("reject");
    expect(envelope.path).toBe("cross-window-bridge");
    expect(envelope.targetWindowId).toBe("win-b");
  });

  it("diagnostic helpers emit start/commit/abort/reject outcomes", () => {
    const runtime = {
      lastDndDiagnostic: null,
    } as {
      lastDndDiagnostic: ReturnType<typeof createDndDiagnosticEnvelope> | null;
    };

    const shared = {
      path: "same-window",
      reason: "helper-shape",
      sourceWindowId: "win-a",
      targetWindowId: "win-a",
      tabId: "tab-1",
      correlation: {
        transferId: "tx-1",
        operationId: "op-1",
      },
    } as const;

    const start = emitDndStart(runtime, shared);
    const commit = emitDndCommit(runtime, shared);
    const abort = emitDndAbort(runtime, shared);
    const reject = emitDndReject(runtime, shared);

    expect(start.outcome).toBe("start");
    expect(commit.outcome).toBe("commit");
    expect(abort.outcome).toBe("abort");
    expect(reject.outcome).toBe("reject");
    expect(runtime.lastDndDiagnostic).toBe(reject);
  });
});
