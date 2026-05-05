import type { ProductionRule } from "@ghost-shell/arbiter";

export interface WeaverSchemaEntry {
  readonly path: string;
  readonly weaver: {
    readonly changePolicy?: string;
    readonly maxOverrideLayer?: string;
    readonly visibility?: string;
    readonly sessionMode?: string;
    readonly sensitive?: boolean;
  };
}

export interface GovernanceRuleContext {
  readonly layer: string;
  readonly layerRank: number;
  readonly layerRanks: ReadonlyMap<string, number>;
  readonly authRoles: readonly string[];
}

function uiPath(fieldPath: string, prop: string): string {
  return `$ui.${fieldPath}.${prop}`;
}

function buildCeilingRule(entry: WeaverSchemaEntry, context: GovernanceRuleContext): ProductionRule | undefined {
  const ceiling = entry.weaver.maxOverrideLayer;
  if (ceiling === undefined) {
    return undefined;
  }
  const ceilingRank = context.layerRanks.get(ceiling);
  if (ceilingRank === undefined) {
    return undefined;
  }

  // Static rule: current layer exceeds ceiling → readOnly
  if (context.layerRank > ceilingRank) {
    return {
      name: `governance.ceiling.${entry.path}`,
      description: `Layer ${context.layer} exceeds ceiling ${ceiling} for ${entry.path}`,
      when: { $always: true },
      // biome-ignore lint/suspicious/noThenProperty: rule DSL action clause
      then: [{ $set: { [uiPath(entry.path, "readOnly")]: true } }],
    };
  }
  return undefined;
}

function buildChangePolicyRule(entry: WeaverSchemaEntry): ProductionRule | undefined {
  const policy = entry.weaver.changePolicy;
  if (policy === undefined || policy === "direct-allowed") {
    return undefined;
  }

  return {
    name: `governance.changePolicy.${entry.path}`,
    description: `Change policy "${policy}" requires session for ${entry.path}`,
    when: { $session: { active: { $ne: true } } },
    // biome-ignore lint/suspicious/noThenProperty: rule DSL action clause
    then: [{ $set: { [uiPath(entry.path, "readOnly")]: true } }],
  };
}

function buildVisibilityRule(entry: WeaverSchemaEntry, context: GovernanceRuleContext): ProductionRule | undefined {
  const role = entry.weaver.visibility;
  if (role === undefined) {
    return undefined;
  }

  if (!context.authRoles.includes(role)) {
    return {
      name: `governance.visibility.${entry.path}`,
      description: `Role "${role}" required for ${entry.path}`,
      when: { $always: true },
      // biome-ignore lint/suspicious/noThenProperty: rule DSL action clause
      then: [{ $set: { [uiPath(entry.path, "visible")]: false } }],
    };
  }
  return undefined;
}

function buildSessionModeRule(entry: WeaverSchemaEntry): ProductionRule | undefined {
  const mode = entry.weaver.sessionMode;
  if (mode === undefined) {
    return undefined;
  }

  return {
    name: `governance.sessionMode.${entry.path}`,
    description: `Session mode "${mode}" toggles readOnly for ${entry.path}`,
    when: { $session: { active: { $ne: true } } },
    // biome-ignore lint/suspicious/noThenProperty: rule DSL action clause
    then: [{ $set: { [uiPath(entry.path, "readOnly")]: true } }],
    else: [{ $set: { [uiPath(entry.path, "readOnly")]: false } }],
  };
}

/**
 * Generates arbiter production rules from weaver schema entries,
 * enforcing governance constraints as dynamic field state.
 */
export function buildGovernanceRules(
  entries: readonly WeaverSchemaEntry[],
  context: GovernanceRuleContext,
): ProductionRule[] {
  const rules: ProductionRule[] = [];

  for (const entry of entries) {
    const ceiling = buildCeilingRule(entry, context);
    if (ceiling !== undefined) {
      rules.push(ceiling);
    }

    const changePolicy = buildChangePolicyRule(entry);
    if (changePolicy !== undefined) {
      rules.push(changePolicy);
    }

    const visibility = buildVisibilityRule(entry, context);
    if (visibility !== undefined) {
      rules.push(visibility);
    }

    const sessionMode = buildSessionModeRule(entry);
    if (sessionMode !== undefined) {
      rules.push(sessionMode);
    }
  }

  return rules;
}
