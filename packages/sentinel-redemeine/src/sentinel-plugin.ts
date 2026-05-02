import { check, expand } from '@ghost/sentinel';
import type { CheckContext, SentinelPrincipal } from '@ghost/sentinel';
import { resolveAction } from './action-mapper.js';
import { AuthorizationError, type SentinelPluginConfig, type EvaluationMode } from './types.js';

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

function buildCheckContext(
  mode: EvaluationMode,
  principal: SentinelPrincipal,
  ctx: CommandContext,
  buildResource: SentinelPluginConfig['buildResource'],
): CheckContext | undefined {
  const resource = buildResource
    ? buildResource({ aggregateId: ctx.aggregateId, commandType: ctx.commandType, payload: ctx.payload })
    : { id: ctx.aggregateId, type: ctx.commandType };

  if (mode.kind === 'snapshot') {
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
    effect: 'deny' as const,
    matchedRules: [] as readonly { name: string; effect: string; salience: number }[],
    reason: 'No evaluation context available',
  };
}

/** Create a Sentinel authorization plugin for redemeine */
export function createSentinelPlugin(config: SentinelPluginConfig): RedemeinePlugin {
  const {
    actionMap,
    resolvePrincipal,
    mode,
    denyUnmapped = false,
    denyAnonymous = true,
    buildResource,
  } = config;

  return {
    key: 'sentinel-auth',
    async onBeforeCommand(ctx: CommandContext) {
      const action = resolveAction(actionMap, ctx.commandType);
      if (!action) {
        if (denyUnmapped) {
          throw new AuthorizationError({
            principal: { userId: 'unknown', tenantId: 'unknown', roles: [], partyIds: [], orgChain: [] },
            action: ctx.commandType,
            commandType: ctx.commandType,
            aggregateId: ctx.aggregateId,
            checkResult: { effect: 'deny', matchedRules: [], reason: 'Unmapped command denied' },
          });
        }
        return;
      }

      const principal = resolvePrincipal(ctx.meta);
      if (!principal) {
        if (denyAnonymous) {
          throw new AuthorizationError({
            principal: { userId: 'anonymous', tenantId: 'unknown', roles: [], partyIds: [], orgChain: [] },
            action,
            commandType: ctx.commandType,
            aggregateId: ctx.aggregateId,
            checkResult: { effect: 'deny', matchedRules: [], reason: 'Anonymous access denied' },
          });
        }
        return;
      }

      const checkContext = buildCheckContext(mode, principal, ctx, buildResource);
      if (!checkContext) {
        throw new AuthorizationError({
          principal,
          action,
          commandType: ctx.commandType,
          aggregateId: ctx.aggregateId,
          checkResult: createDeniedResult(),
        });
      }

      const result = check(principal, action, checkContext);

      if (result.effect === 'deny') {
        const derivation = expand(principal, action, checkContext);
        throw new AuthorizationError({
          principal,
          action,
          commandType: ctx.commandType,
          aggregateId: ctx.aggregateId,
          checkResult: result,
          derivation,
        });
      }
    },
  };
}
