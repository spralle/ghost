import { describe, expect, it } from "vitest";
import { createKeybindingService } from "@ghost-shell/commands";
import type { IntentRuntime } from "@ghost-shell/intents";
import { createDefaultContributionPredicateMatcher } from "@ghost-shell/plugin-system";
import type { ActionSurface } from "../action-surface.js";
function createActionSurface(): ActionSurface {
  return {
    actions: [
      {
        id: "shell.action.default",
        title: "Default Action",
        intent: "shell.intent.default",
        pluginId: "shell.defaults",
      },
      {
        id: "shell.action.plugin",
        title: "Plugin Action",
        intent: "shell.intent.plugin",
        pluginId: "plugin.a",
      },
      {
        id: "shell.action.hidden",
        title: "Hidden Action",
        intent: "shell.intent.hidden",
        pluginId: "plugin.b",
        when: {
          mode: "enabled",
        },
      },
    ],
    menus: [],
    keybindings: [
      {
        action: "shell.action.plugin",
        keybinding: "shift+ctrl+p",
        pluginId: "plugin.a",
      },
      {
        action: "shell.action.hidden",
        keybinding: "ctrl+h",
        pluginId: "plugin.b",
        when: {
          role: "admin",
        },
      },
    ],
  };
}

function createIntentRuntime(calls: { intent: string; context: Readonly<Record<string, string>> }[]): IntentRuntime {
  return {
    async resolve(intent, _delegate, _options) {
      calls.push({
        intent: intent.type,
        context: intent.facts as Readonly<Record<string, string>>,
      });

      const trace = { intentType: intent.type, evaluatedAt: 0, actions: [], matched: [] };
      if (intent.type === "shell.intent.hidden") {
        return { kind: "no-match", feedback: "no match", trace };
      }
      return {
        kind: "executed",
        match: {
          pluginId: "stub",
          pluginName: "Stub",
          actionId: "stub",
          title: "Stub",
          handler: "stub",
          intentType: intent.type,
          when: {},
          loadStrategy: "eager",
          registrationOrder: 0,
          sortKey: "stub",
        },
        trace,
      };
    },
  };
}

describe("keybinding service", () => {
  it("normalizer canonicalizes keyboard events and configured chords", () => {
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime([]),
    });

    const fromEvent = service.normalizeEvent({
      key: "P",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent);

    expect(fromEvent).toBeTruthy();
    expect(fromEvent?.value).toBe("ctrl+shift+p");

    const resolution = service.resolve(
      {
        modifiers: ["ctrl", "shift"],
        key: "p",
        value: "ctrl+shift+p",
      },
      {},
    );
    expect(resolution.match?.action.id).toBe("shell.action.plugin");
  });

  it("layer precedence resolves user overrides ahead of plugins and defaults", async () => {
    const calls: { intent: string; context: Readonly<Record<string, string>> }[] = [];
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime(calls),
      defaultBindings: [
        {
          action: "shell.action.default",
          keybinding: "ctrl+o",
          pluginId: "shell.defaults",
        },
      ],
      userOverrideBindings: [
        {
          action: "shell.action.plugin",
          keybinding: "ctrl+o",
          pluginId: "user.override",
        },
      ],
    });

    const result = service.resolve(
      {
        modifiers: ["ctrl"],
        key: "o",
        value: "ctrl+o",
      },
      {},
    );
    expect(result.match?.action.id).toBe("shell.action.plugin");
    expect(result.match?.source.layer).toBe("user-overrides");

    await service.dispatch(
      {
        modifiers: ["ctrl"],
        key: "o",
        value: "ctrl+o",
      },
      {
        tabId: "tab-a",
      },
    );
    expect(calls.length).toBe(1);
    expect(calls[0]?.intent).toBe("shell.intent.plugin");
  });

  it("resolver respects predicates and reports non-executable dispatch", async () => {
    const calls: { intent: string; context: Readonly<Record<string, string>> }[] = [];
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime(calls),
      matcher: createDefaultContributionPredicateMatcher(),
    });

    const denied = service.resolve(
      {
        modifiers: ["ctrl"],
        key: "h",
        value: "ctrl+h",
      },
      {
        role: "operator",
        mode: "enabled",
      },
    );
    expect(denied.match).toBe(null);

    const allowed = await service.dispatch(
      {
        modifiers: ["ctrl"],
        key: "h",
        value: "ctrl+h",
      },
      {
        role: "admin",
        mode: "enabled",
      },
    );
    expect(allowed.resolution.match?.action.id).toBe("shell.action.hidden");
    expect(allowed.executed).toBe(false);
    expect(calls.length).toBe(1);
  });

  it("resolveSequence with single chord works like legacy resolve", () => {
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime([]),
    });

    const result = service.resolveSequence(
      [
        {
          modifiers: ["ctrl", "shift"],
          key: "p",
          value: "ctrl+shift+p",
        },
      ],
      {},
    );

    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("shell.action.plugin");
    expect(result.chords.length).toBe(1);
  });

  it("resolveSequence with multi-chord sequence returns exact match", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime([]),
    });

    const result = service.resolveSequence(
      [
        { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
        { modifiers: ["ctrl"], key: "c", value: "ctrl+c" },
      ],
      {},
    );

    expect(result.kind).toBe("exact");
    expect(result.match?.action.id).toBe("shell.action.multi");
  });

  it("resolveSequence with partial sequence returns prefix", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime([]),
    });

    const result = service.resolveSequence([{ modifiers: ["ctrl"], key: "k", value: "ctrl+k" }], {});

    expect(result.kind).toBe("prefix");
    expect((result.prefixCount ?? 0) > 0).toBeTruthy();
  });

  it("hasPrefix returns true for valid prefix, false for non-prefix", () => {
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime([]),
    });

    const hasValid = service.hasPrefix([{ modifiers: ["ctrl"], key: "k", value: "ctrl+k" }], {});
    expect(hasValid).toBe(true);

    const hasInvalid = service.hasPrefix([{ modifiers: ["ctrl"], key: "z", value: "ctrl+z" }], {});
    expect(hasInvalid).toBe(false);
  });

  it("dispatchSequence only dispatches on exact match", async () => {
    const calls: { intent: string; context: Readonly<Record<string, string>> }[] = [];
    const surface: ActionSurface = {
      actions: [
        {
          id: "shell.action.multi",
          title: "Multi Action",
          intent: "shell.intent.multi",
          pluginId: "shell.defaults",
        },
      ],
      menus: [],
      keybindings: [
        {
          action: "shell.action.multi",
          keybinding: "ctrl+k ctrl+c",
          pluginId: "shell.defaults",
        },
      ],
    };

    const service = createKeybindingService({
      actionSurface: surface,
      intentRuntime: createIntentRuntime(calls),
    });

    // Partial sequence should not dispatch
    const partial = await service.dispatchSequence([{ modifiers: ["ctrl"], key: "k", value: "ctrl+k" }], {});
    expect(partial.executed).toBe(false);
    expect(calls.length).toBe(0);

    // Full sequence should dispatch
    const full = await service.dispatchSequence(
      [
        { modifiers: ["ctrl"], key: "k", value: "ctrl+k" },
        { modifiers: ["ctrl"], key: "c", value: "ctrl+c" },
      ],
      {},
    );
    expect(full.resolution.match?.action.id).toBe("shell.action.multi");
    expect(full.executed).toBe(true);
    expect(calls.length).toBe(1);
  });

  it("service exposes sequence lifecycle event emitters", () => {
    const service = createKeybindingService({
      actionSurface: createActionSurface(),
      intentRuntime: createIntentRuntime([]),
    });

    // onDidKeySequencePending
    const pendingEvents: Array<{ pressedChords: string[]; candidateCount: number }> = [];
    const sub1 = service.onDidKeySequencePending((e: { pressedChords: string[]; candidateCount: number }) =>
      pendingEvents.push(e),
    );
    service.fireKeySequencePending({ pressedChords: ["ctrl+k"], candidateCount: 3 });
    expect(pendingEvents.length).toBe(1);
    expect(pendingEvents[0]?.pressedChords[0]).toBe("ctrl+k");
    expect(pendingEvents[0]?.candidateCount).toBe(3);
    sub1.dispose();

    // onDidKeySequenceCompleted
    const completedEvents: Array<{ chords: string[]; actionId: string }> = [];
    const sub2 = service.onDidKeySequenceCompleted((e: { chords: string[]; actionId: string }) =>
      completedEvents.push(e),
    );
    service.fireKeySequenceCompleted({ chords: ["ctrl+k", "ctrl+c"], actionId: "test.action" });
    expect(completedEvents.length).toBe(1);
    expect(completedEvents[0]?.actionId).toBe("test.action");
    sub2.dispose();

    // onDidKeySequenceCancelled
    const cancelledEvents: Array<{ chords: string[]; reason: string }> = [];
    const sub3 = service.onDidKeySequenceCancelled((e: { chords: string[]; reason: string }) =>
      cancelledEvents.push(e),
    );
    service.fireKeySequenceCancelled({ chords: ["ctrl+k"], reason: "timeout" });
    expect(cancelledEvents.length).toBe(1);
    expect(cancelledEvents[0]?.reason).toBe("timeout");
    sub3.dispose();

    // After dispose, events should not fire
    service.fireKeySequencePending({ pressedChords: ["ctrl+x"], candidateCount: 1 });
    expect(pendingEvents.length).toBe(1);
  });
});
