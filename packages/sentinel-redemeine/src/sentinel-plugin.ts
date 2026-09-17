import type { CheckContext, CheckResult, DerivationNode, SentinelPrincipal } from "@ghost/sentinel";
import { check, expand } from "@ghost/sentinel";
import { resolveAction } from "./action-mapper.js";
import { AuthorizationError, type EvaluationMode, type SentinelPluginConfig } from "./types.js";

/** Shape of the redemeine CommandInterceptorContext we consume */
interface CommandContext {
  aggregateId: string;
  commandType: string;
  payload: unknown;
  meta: unknown;
}

/** Shape of a RedemeinePlugin — avoids hard dep on redemeine package */
interface RedemeinePlugin {
  key: string;
  onBeforeCommand?: (ctx: CommandContext) => void | Promise<void>;
}

export interface SentinelPluginDependencies {
  readonly check: typeof check;
  readonly expand: typeof expand;
}

const defaultDependencies: SentinelPluginDependencies = { check, expand };

function buildCheckContext(
  mode: EvaluationMode,
  principal: SentinelPrincipal,
  ctx: CommandContext,
  buildResource: SentinelPluginConfig["buildResource"],
): CheckContext | undefined {
  const resource = buildResource
    ? buildResource({ aggregateId: ctx.aggregateId, commandType: ctx.commandType, payload: ctx.payload })
    : { id: ctx.aggregateId, type: ctx.commandType };

  if (mode.kind === "snapshot") {
    const snapshot = mode.getSnapshot(principal.userId);
    if (!snapshot) return undefined;
    return {
      policy: snapshot.compiledPolicy,
      graphSubset: snapshot.graphCone,
      resource,
    };
  }

  const policy = mode.store.getCompiledPolicy(principal.tenantId);
  const graphSubset = mode.store.getGraphSubset(principal.userId);
  if (!policy || !graphSubset) return undefined;
  return { policy, graphSubset, resource };
}

function createDeniedResult() {
  return {
    effect: "deny" as const,
    matchedRules: [] as readonly { name: string; effect: string; salience: number }[],
    reason: "No evaluation context available",
  };
}

async function authorizeCommand(
  config: SentinelPluginConfig,
  dependencies: SentinelPluginDependencies,
  ctx: CommandContext,
): Promise<void> {
  const { actionMap, resolvePrincipal, mode, denyUnmapped = false, denyAnonymous = true, buildResource } = config;
  const action = resolveAction(actionMap, ctx.commandType);
  if (!action) return handleUnmappedCommand(ctx, denyUnmapped);

  const principal = resolvePrincipal(ctx.meta);
  if (!principal) return handleAnonymousCommand(ctx, action, denyAnonymous);

  const checkContext = buildCheckContext(mode, principal, ctx, buildResource);
  if (!checkContext) throw createAuthorizationError(principal, action, ctx, createDeniedResult());

  const result = dependencies.check(principal, action, checkContext);
  if (result.effect !== "deny") return;

  const derivation = dependencies.expand(principal, action, checkContext);
  throw createAuthorizationError(principal, action, ctx, result, derivation);
}

function handleUnmappedCommand(ctx: CommandContext, denyUnmapped: boolean): void {
  if (!denyUnmapped) return;
  const principal = { userId: "unknown", tenantId: "unknown", roles: [], partyIds: [], orgChain: [] };
  const result = { effect: "deny" as const, matchedRules: [], reason: "Unmapped command denied" };
  throw createAuthorizationError(principal, ctx.commandType, ctx, result);
}

function handleAnonymousCommand(ctx: CommandContext, action: string, denyAnonymous: boolean): void {
  if (!denyAnonymous) return;
  const principal = { userId: "anonymous", tenantId: "unknown", roles: [], partyIds: [], orgChain: [] };
  const result = { effect: "deny" as const, matchedRules: [], reason: "Anonymous access denied" };
  throw createAuthorizationError(principal, action, ctx, result);
}

function createAuthorizationError(
  principal: SentinelPrincipal,
  action: string,
  ctx: CommandContext,
  checkResult: CheckResult,
  derivation?: DerivationNode,
): AuthorizationError {
  return new AuthorizationError({
    principal,
    action,
    commandType: ctx.commandType,
    aggregateId: ctx.aggregateId,
    checkResult,
    ...(derivation !== undefined && { derivation }),
  });
}

/** Create a Sentinel authorization plugin for redemeine */
export function createSentinelPlugin(
  config: SentinelPluginConfig,
  dependencies: SentinelPluginDependencies = defaultDependencies,
): RedemeinePlugin {
  return {
    key: "sentinel-auth",
    onBeforeCommand: (ctx) => authorizeCommand(config, dependencies, ctx),
  };
}
