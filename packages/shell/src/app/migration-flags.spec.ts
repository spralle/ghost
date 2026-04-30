import { describe, expect, it } from "vitest";
import { readShellMigrationFlags, selectCrossWindowDnd, selectShellTransportPath } from "./migration-flags.js";

describe("migration-flags", () => {
  it("cross-window dnd flags default enabled and can disable", () => {
    const defaults = readShellMigrationFlags(new URLSearchParams(), null);
    const disabled = readShellMigrationFlags(new URLSearchParams("shellCrossWindowDnd=0"), null);

    expect(defaults.enableCrossWindowDnd).toBe(true);
    expect(defaults.forceDisableCrossWindowDnd).toBe(false);
    expect(disabled.enableCrossWindowDnd).toBe(false);
  });

  it("cross-window dnd kill-switch override takes precedence", () => {
    const flags = readShellMigrationFlags(
      new URLSearchParams("shellCrossWindowDnd=true&shellCrossWindowDndKillSwitch=1"),
      { enableCrossWindowDnd: true, forceDisableCrossWindowDnd: true },
    );

    expect(flags.enableCrossWindowDnd).toBe(true);
    expect(flags.forceDisableCrossWindowDnd).toBe(true);
  });

  it("transport path defaults to legacy when async flag is unset", () => {
    const flags = readShellMigrationFlags(new URLSearchParams(), null);
    const decision = selectShellTransportPath(flags);

    expect(decision.path).toBe("legacy-bridge");
    expect(decision.reason).toBe("default-legacy");
  });

  it("transport path switches to async adapter when async flag is enabled", () => {
    const flags = readShellMigrationFlags(new URLSearchParams("shellAsyncScompAdapter=true"), null);
    const decision = selectShellTransportPath(flags);

    expect(decision.path).toBe("async-scomp-adapter");
    expect(decision.reason).toBe("async-flag-enabled");
  });

  it("transport kill switch forces legacy ahead of async enable flag", () => {
    const flags = readShellMigrationFlags(
      new URLSearchParams("shellAsyncScompAdapter=true&shellLegacyBridgeKillSwitch=1"),
      null,
    );
    const decision = selectShellTransportPath(flags);

    expect(decision.path).toBe("legacy-bridge");
    expect(decision.reason).toBe("kill-switch-force-legacy");
  });

  it("window overrides can force legacy kill switch over query async enable", () => {
    const flags = readShellMigrationFlags(new URLSearchParams("shellAsyncScompAdapter=true"), {
      forceLegacyBridge: true,
    });
    const decision = selectShellTransportPath(flags);

    expect(decision.path).toBe("legacy-bridge");
    expect(decision.reason).toBe("kill-switch-force-legacy");
  });

  it("transport feature-flag matrix preserves deterministic legacy/async parity", () => {
    const matrix = [
      {
        name: "default",
        query: "",
        override: null,
        expectedPath: "legacy-bridge",
        expectedReason: "default-legacy",
      },
      {
        name: "async-query-enable",
        query: "shellAsyncScompAdapter=1",
        override: null,
        expectedPath: "async-scomp-adapter",
        expectedReason: "async-flag-enabled",
      },
      {
        name: "kill-switch-query-wins",
        query: "shellAsyncScompAdapter=1&shellLegacyBridgeKillSwitch=true",
        override: null,
        expectedPath: "legacy-bridge",
        expectedReason: "kill-switch-force-legacy",
      },
      {
        name: "override-enable-async",
        query: "",
        override: {
          enableAsyncScompAdapter: true,
        },
        expectedPath: "async-scomp-adapter",
        expectedReason: "async-flag-enabled",
      },
      {
        name: "override-force-legacy-over-enable",
        query: "shellAsyncScompAdapter=true",
        override: {
          enableAsyncScompAdapter: true,
          forceLegacyBridge: true,
        },
        expectedPath: "legacy-bridge",
        expectedReason: "kill-switch-force-legacy",
      },
    ] as const;

    for (const scenario of matrix) {
      const flags = readShellMigrationFlags(new URLSearchParams(scenario.query), scenario.override);
      const decision = selectShellTransportPath(flags);
      expect(decision.path).toBe(scenario.expectedPath);
      expect(decision.reason).toBe(scenario.expectedReason);
    }
  });

  it("cross-window dnd defaults to cross-window bridge", () => {
    const flags = readShellMigrationFlags(new URLSearchParams(), null);
    const decision = selectCrossWindowDnd(flags);

    expect(decision.enabled).toBe(true);
    expect(decision.path).toBe("cross-window-bridge");
    expect(decision.reason).toBe("flag-enabled");
  });

  it("cross-window dnd flag can be enabled explicitly", () => {
    const flags = readShellMigrationFlags(new URLSearchParams("shellCrossWindowDnd=true"), null);
    const decision = selectCrossWindowDnd(flags);

    expect(decision.enabled).toBe(true);
    expect(decision.path).toBe("cross-window-bridge");
    expect(decision.reason).toBe("flag-enabled");
  });

  it("cross-window dnd kill switch wins over enable flag", () => {
    const flags = readShellMigrationFlags(
      new URLSearchParams("shellCrossWindowDnd=true&shellCrossWindowDndKillSwitch=1"),
      null,
    );
    const decision = selectCrossWindowDnd(flags);

    expect(decision.enabled).toBe(false);
    expect(decision.path).toBe("same-window");
    expect(decision.reason).toBe("kill-switch-force-disabled");
  });

  it("cross-window dnd override kill switch wins over query enable", () => {
    const flags = readShellMigrationFlags(new URLSearchParams("shellCrossWindowDnd=true"), {
      forceDisableCrossWindowDnd: true,
    });
    const decision = selectCrossWindowDnd(flags);

    expect(decision.enabled).toBe(false);
    expect(decision.path).toBe("same-window");
    expect(decision.reason).toBe("kill-switch-force-disabled");
  });
});
