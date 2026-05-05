import { describe, expect, it } from "vitest";
import type { GovernanceRuleContext, WeaverSchemaEntry } from "../governance-rules.js";
import { buildGovernanceRules } from "../governance-rules.js";

function makeContext(overrides?: Partial<GovernanceRuleContext>): GovernanceRuleContext {
  return {
    layer: "user",
    layerRank: 2,
    layerRanks: new Map([
      ["default", 0],
      ["system", 1],
      ["user", 2],
      ["workspace", 3],
    ]),
    authRoles: ["admin", "editor"],
    ...overrides,
  };
}

describe("buildGovernanceRules", () => {
  it("generates ceiling readOnly rule when layer exceeds maxOverrideLayer", () => {
    const entries: WeaverSchemaEntry[] = [{ path: "editor.fontSize", weaver: { maxOverrideLayer: "system" } }];
    const rules = buildGovernanceRules(entries, makeContext({ layerRank: 2 }));
    const rule = rules.find((r) => r.name.includes("ceiling"));
    expect(rule).toBeDefined();
    expect(rule!.then).toEqual([{ $set: { "$ui.editor.fontSize.readOnly": true } }]);
  });

  it("does NOT generate ceiling rule when layer is within ceiling", () => {
    const entries: WeaverSchemaEntry[] = [{ path: "editor.fontSize", weaver: { maxOverrideLayer: "workspace" } }];
    const rules = buildGovernanceRules(entries, makeContext({ layerRank: 2 }));
    const rule = rules.find((r) => r.name.includes("ceiling"));
    expect(rule).toBeUndefined();
  });

  it("generates changePolicy readOnly rule for non-direct policies", () => {
    const entries: WeaverSchemaEntry[] = [{ path: "server.port", weaver: { changePolicy: "restart-required" } }];
    const rules = buildGovernanceRules(entries, makeContext());
    const rule = rules.find((r) => r.name.includes("changePolicy"));
    expect(rule).toBeDefined();
    expect(rule!.then).toEqual([{ $set: { "$ui.server.port.readOnly": true } }]);
  });

  it("does NOT generate changePolicy rule for direct-allowed", () => {
    const entries: WeaverSchemaEntry[] = [{ path: "server.port", weaver: { changePolicy: "direct-allowed" } }];
    const rules = buildGovernanceRules(entries, makeContext());
    const rule = rules.find((r) => r.name.includes("changePolicy"));
    expect(rule).toBeUndefined();
  });

  it("generates visibility rule when role not in authRoles", () => {
    const entries: WeaverSchemaEntry[] = [{ path: "secret.key", weaver: { visibility: "superadmin" } }];
    const rules = buildGovernanceRules(entries, makeContext({ authRoles: ["editor"] }));
    const rule = rules.find((r) => r.name.includes("visibility"));
    expect(rule).toBeDefined();
    expect(rule!.then).toEqual([{ $set: { "$ui.secret.key.visible": false } }]);
  });

  it("generates sessionMode toggle rule", () => {
    const entries: WeaverSchemaEntry[] = [{ path: "live.setting", weaver: { sessionMode: "session-only" } }];
    const rules = buildGovernanceRules(entries, makeContext());
    const rule = rules.find((r) => r.name.includes("sessionMode"));
    expect(rule).toBeDefined();
    expect(rule!.then).toEqual([{ $set: { "$ui.live.setting.readOnly": true } }]);
    expect(rule!.else).toEqual([{ $set: { "$ui.live.setting.readOnly": false } }]);
  });
});
