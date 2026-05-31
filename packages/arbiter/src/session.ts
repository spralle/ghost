import { createAccumulateManager } from "./accumulate-manager.js";
import type { AccumulateConfig } from "./accumulate-node.js";
import { createAgenda } from "./agenda.js";
import { createAlphaNetwork } from "./alpha-network.js";
import { createBetaEvaluator } from "./beta-evaluator.js";
import type {
  CompiledRule,
  FiringResult,
  ProductionRule,
  RuleSession,
  SessionConfig,
  SubscriptionCallback,
  Unsubscribe,
} from "./contracts.js";
import type { VirtualClock } from "./clock.js";
import { ArbiterError, ArbiterErrorCode } from "./errors.js";
import { createOperatorRegistry } from "./expression-operators.js";
import { TEMPORAL_OPERATORS } from "./temporal-operators.js";
import type { Fact } from "./fact-memory.js";
import { createFactMemory } from "./fact-memory.js";
import { createFactRegistry } from "./fact-registry.js";
import { evaluateCondition } from "./fire-cycle.js";
import type { FireContext, FireLimits } from "./fire-cycle.js";
import { fireCycle } from "./fire-cycle.js";
import type { Token } from "./beta-node.js";
import { validatePath } from "./path-utils.js";
import { compileRule } from "./rule-compiler.js";
import { createScopeManager } from "./scope.js";
import { createTimerQueue } from "./timer-queue.js";
import type { ScheduleOptions } from "./timer-queue.js";
import { createTms } from "./tms.js";
import { createExpiryTracker } from "./expiry-tracker.js";
import type { ExpiryTracker } from "./expiry-tracker.js";
import { createCrossTypeAccumulator } from "./cross-type-accumulate.js";
import type { CrossTypeAccumulator } from "./cross-type-accumulate.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSession<TState = Record<string, unknown>>(config?: SessionConfig<TState>): RuleSession<TState> {
  const scope = createScopeManager(config?.initialState);
  const network = createAlphaNetwork();
  const agenda = createAgenda();
  const tms = createTms(config?.tms);
  const customOps = config?.clock
    ? { ...TEMPORAL_OPERATORS, ...config?.operators?.custom }
    : config?.operators?.custom;
  const operators = createOperatorRegistry(customOps);

  // Fact support (optional — only active when factTypes provided)
  const factTypesConfig = config?.factTypes;
  const factRegistry = factTypesConfig ? createFactRegistry() : undefined;
  const factMemory = factTypesConfig ? createFactMemory() : undefined;
  const betaEvaluator = createBetaEvaluator();

  if (factRegistry && factTypesConfig) {
    for (const def of factTypesConfig) {
      factRegistry.register(def);
    }
  }

  // Accumulate support (optional — lazily created if rules declare inline accumulates)
  const singleTypeAccumulates = config?.accumulates?.filter((c) => !c.binding || !c.rule);
  let accumulateManager = singleTypeAccumulates?.length
    ? createAccumulateManager(singleTypeAccumulates, config.accumulateFunctions, config?.clock)
    : undefined;

  // Cross-type accumulate support (join-scoped aggregation)
  let crossTypeAccumulator: CrossTypeAccumulator | undefined = config?.accumulates?.length
    ? createCrossTypeAccumulator(config.accumulates, config.accumulateFunctions)
    : undefined;

  function syncAggregates(): void {
    const agg: Record<string, unknown> = {};
    if (accumulateManager) {
      Object.assign(agg, accumulateManager.getAggregates());
    }
    if (crossTypeAccumulator) {
      Object.assign(agg, crossTypeAccumulator.getValues());
    }
    if (Object.keys(agg).length > 0) {
      scope.set("$aggregates", agg, "__accumulate__");
    }
  }

  const compiledRules = new Map<string, CompiledRule>();
  const subscriptions = new Map<string, Set<SubscriptionCallback>>();
  const ruleConditionState = new Map<string, boolean>();
  const pendingTokens = new Map<string, Token>();
  let disposed = false;

  const clock = config?.clock;
  const timerQueue = clock ? createTimerQueue() : undefined;

  // Expiry tracker: only created when clock exists and rules have expires
  const expiryMap = new Map<string, number>();
  for (const rule of config?.rules ?? []) {
    if (rule.expires !== undefined) {
      expiryMap.set(rule.name, rule.expires);
    }
  }
  const expiryTracker: ExpiryTracker | undefined =
    clock && expiryMap.size > 0 ? createExpiryTracker(expiryMap) : undefined;

  function injectClockTime(): void {
    if (clock) {
      scope.set("$meta.$now", clock.now(), "__clock__");
    }
  }

  const limits: FireLimits = {
    maxCycles: config?.limits?.maxCycles ?? 100,
    maxRuleFirings: config?.limits?.maxRuleFirings ?? 1000,
    warnAtCycles: config?.limits?.warnAtCycles ?? 80,
    warnAtFirings: config?.limits?.warnAtFirings ?? 800,
  };

  for (const rule of config?.rules ?? []) {
    registerRuleInternal(rule);
  }

  function assertNotDisposed(): void {
    if (disposed) {
      throw new ArbiterError(ArbiterErrorCode.SESSION_DISPOSED, "Session has been disposed");
    }
  }

  function buildContext(): FireContext {
    const ctx: FireContext = {
      scope,
      network,
      agenda,
      tms,
      compiledRules,
      operators,
      limits,
      ruleConditionState,
      pendingTokens,
    };
    if (config?.thenOperators) {
      return { ...ctx, thenOperators: config.thenOperators };
    }
    return ctx;
  }

  function registerRuleInternal(rule: ProductionRule<TState>): void {
    const compiled = compileRule(rule as ProductionRule<unknown>);
    compiledRules.set(compiled.name, compiled);
    network.addRule(compiled);

    if (rule.expires !== undefined) {
      expiryMap.set(rule.name, rule.expires);
    }

    if (compiled.hasPatterns && compiled.patterns) {
      const sourcePatterns = rule.patterns ?? [];
      betaEvaluator.registerRule(compiled.name, sourcePatterns);
    }

    if (compiled.accumulates?.length) {
      if (!accumulateManager) {
        accumulateManager = createAccumulateManager([], config?.accumulateFunctions, clock);
      }
      if (!crossTypeAccumulator) {
        crossTypeAccumulator = createCrossTypeAccumulator([], config?.accumulateFunctions);
      }
      for (const acc of compiled.accumulates) {
        accumulateManager.addConfig(acc);
      }
    }
  }

  function registerRule(rule: ProductionRule<TState>): void {
    assertNotDisposed();
    registerRuleInternal(rule);
  }

  function removeRule(name: string): void {
    assertNotDisposed();
    const compiled = compiledRules.get(name);
    if (!compiled) return;
    network.removeRule(name);
    agenda.removeActivation(name);
    tms.removeRule(name);
    scope.revertRule(name);
    scope.clearWriteRecords(name);
    ruleConditionState.delete(name);
    betaEvaluator.removeRule(name);
    compiledRules.delete(name);
  }

  function assertPath(path: string, value: unknown): void {
    assertNotDisposed();
    validatePath(path);
    scope.set(path, value, "__assert__");
  }

  function retract(path: string): void {
    assertNotDisposed();
    validatePath(path);
    scope.unset(path, "__assert__");
  }

  function fire(): FiringResult {
    assertNotDisposed();
    injectClockTime();
    const ctx = buildContext();
    const result = fireCycle(ctx);
    // Track activations for expiry (only on first activation, not re-fires)
    if (expiryTracker && clock) {
      // Reset tracking for rules whose condition became false (enables re-activation)
      for (const ruleName of expiryMap.keys()) {
        const isActive = ruleConditionState.get(ruleName) ?? false;
        if (!isActive) {
          expiryTracker.reset(ruleName);
        }
      }
      for (const change of result.changes) {
        if (expiryMap.has(change.ruleName)) {
          expiryTracker.onRuleActivated(change.ruleName, clock.now());
        }
      }
    }
    // Track fact dependencies for pattern-based rules that fired
    trackPatternRuleProvenance(result);
    notifySubscribers(result.changes);
    return result;
  }

  /** After firing, record which facts contributed to each pattern-rule's writes */
  function trackPatternRuleProvenance(result: FiringResult): void {
    for (const change of result.changes) {
      const rule = compiledRules.get(change.ruleName);
      if (!rule?.hasPatterns) continue;
      // Get current tokens for the rule to find contributing fact IDs
      const tokens = betaEvaluator.getTokensForRule(rule.name);
      const factIds: string[] = [];
      for (const token of tokens) {
        for (const fact of Object.values(token.factBindings)) {
          if (!factIds.includes(fact.id)) factIds.push(fact.id);
        }
      }
      if (factIds.length > 0) {
        tms.recordFactDependency(rule.name, factIds);
      }
    }
  }

  function notifySubscribers(changes: readonly { path: string; newValue: unknown; previousValue: unknown }[]): void {
    for (const change of changes) {
      const callbacks = subscriptions.get(change.path);
      if (!callbacks) continue;
      for (const cb of callbacks) {
        cb(change.newValue, change.previousValue);
      }
    }
  }

  function subscribe(path: string, callback: SubscriptionCallback): Unsubscribe {
    assertNotDisposed();
    let set = subscriptions.get(path);
    if (!set) {
      set = new Set();
      subscriptions.set(path, set);
    }
    set.add(callback);
    return () => {
      set.delete(callback);
    };
  }

  function update(path: string, value: unknown): FiringResult {
    assertPath(path, value);
    return fire();
  }

  function getState(): Readonly<Record<string, unknown>> {
    assertNotDisposed();
    return scope.getState();
  }

  function getPath(path: string): unknown {
    assertNotDisposed();
    return scope.get(path);
  }

  function setFocus(group: string): void {
    assertNotDisposed();
    agenda.setFocus(group);
  }

  function dispose(): void {
    disposed = true;
    compiledRules.clear();
    subscriptions.clear();
    ruleConditionState.clear();
  }

  const autoFire = config?.autoFireOnFactChange !== false;

  function hasScopeConditions(rule: CompiledRule): boolean {
    // A rule has meaningful scope conditions if its `when` is not just `{ $always: true }`
    const when = rule.source.when;
    if (!when || (typeof when === "object" && "$always" in (when as Record<string, unknown>))) return false;
    // If when has real conditions (non-empty object), it has scope conditions
    return typeof when === "object" && Object.keys(when as Record<string, unknown>).length > 0;
  }

  function assertFact(type: string, data: Readonly<Record<string, unknown>>): string {
    assertNotDisposed();
    if (!factRegistry || !factMemory) {
      throw new Error("Fact support not configured. Provide factTypes in SessionConfig.");
    }
    const errors = factRegistry.validate(type, data);
    if (errors.length > 0) {
      throw new Error(`Fact validation failed: ${errors.join("; ")}`);
    }
    const factId = factMemory.assertFact(type, data);
    let aggregatesUpdated = false;
    if (accumulateManager) {
      const fact = factMemory.getFact(factId);
      if (fact) {
        accumulateManager.onFactAsserted(fact);
        syncAggregates();
        aggregatesUpdated = true;
      }
    }
    // Beta evaluation: trigger right-activation for pattern rules
    const fact = factMemory.getFact(factId);
    if (fact) {
      const activations = betaEvaluator.onFactAsserted(type, type, fact);
      for (const activation of activations) {
        const compiled = compiledRules.get(activation.ruleName);
        if (!compiled) continue;
        // Notify cross-type accumulator of new tokens
        if (crossTypeAccumulator) {
          for (const token of activation.tokens) {
            crossTypeAccumulator.onTokenCreated(activation.ruleName, token);
          }
        }
        // For mixed rules, check scope conditions too
        if (hasScopeConditions(compiled)) {
          const conditionMet = evaluateCondition(compiled, scope);
          if (!conditionMet) continue;
        }
        agenda.addActivation(compiled);
        tms.ruleActivated(compiled);
        // Record fact dependencies from the token bindings
        const factIds: string[] = [];
        for (const token of activation.tokens) {
          for (const f of Object.values(token.factBindings)) {
            if (!factIds.includes(f.id)) factIds.push(f.id);
          }
        }
        if (factIds.length > 0) {
          tms.recordFactDependency(compiled.name, factIds);
        }
        // Store the latest complete token for binding injection
        const latestToken = activation.tokens[activation.tokens.length - 1];
        if (latestToken) {
          pendingTokens.set(activation.ruleName, latestToken);
        }
      }
    }
    if (crossTypeAccumulator) {
      syncAggregates();
      aggregatesUpdated = true;
    }
    if (aggregatesUpdated && autoFire) fire();
    return factId;
  }

  function retractFact(id: string): boolean {
    assertNotDisposed();
    if (!factMemory) {
      throw new Error("Fact support not configured. Provide factTypes in SessionConfig.");
    }
    const fact = factMemory.getFact(id);
    const removed = factMemory.retractFact(id) !== undefined;
    let aggregatesUpdated = false;
    if (removed && accumulateManager && fact) {
      accumulateManager.onFactRetracted(fact);
      syncAggregates();
      aggregatesUpdated = true;
    }
    if (removed) {
      const deactivations = betaEvaluator.onFactRetracted(id);
      for (const deactivation of deactivations) {
        // Notify cross-type accumulator of removed tokens
        if (crossTypeAccumulator) {
          for (const token of deactivation.removedTokens) {
            crossTypeAccumulator.onTokenRemoved(deactivation.ruleName, token);
          }
        }
        // If no more complete tokens remain, remove from agenda
        const tokens = betaEvaluator.getTokensForRule(deactivation.ruleName);
        if (tokens.length === 0) {
          agenda.removeActivation(deactivation.ruleName);
        }
      }
      // TMS: retract writes from rules that depended on this fact
      tms.retractByFact(id, scope);
      // Sync cross-type aggregates after token removal
      if (crossTypeAccumulator) {
        syncAggregates();
      }
    }
    if (aggregatesUpdated && autoFire) fire();
    return removed;
  }

  function getFacts(type: string): readonly Fact[] {
    assertNotDisposed();
    if (!factMemory) {
      throw new Error("Fact support not configured. Provide factTypes in SessionConfig.");
    }
    return factMemory.getFactsByType(type);
  }

  function tick(now?: number): FiringResult {
    assertNotDisposed();
    if (!clock) {
      throw new ArbiterError(
        ArbiterErrorCode.INVALID_CLOCK_OPERATION,
        "Clock not configured. Pass { clock } in session config.",
      );
    }
    if (now !== undefined && isVirtualClock(clock)) {
      clock.setTime(now);
    }
    // Check for expired rules BEFORE firing — retract their writes and suppress
    const suppressedRules = new Map<string, CompiledRule>();
    if (expiryTracker) {
      const expired = expiryTracker.getExpiredRules(clock.now());
      for (const ruleName of expired) {
        scope.revertRule(ruleName);
        scope.clearWriteRecords(ruleName);
        ruleConditionState.delete(ruleName);
        expiryTracker.reset(ruleName);
        // Temporarily remove from compiled rules so fire cycle won't re-activate
        const compiled = compiledRules.get(ruleName);
        if (compiled) {
          suppressedRules.set(ruleName, compiled);
          compiledRules.delete(ruleName);
          agenda.removeActivation(ruleName);
        }
      }
    }
    // Evict stale facts from windowed accumulate nodes
    if (accumulateManager) {
      const evicted = accumulateManager.evict(clock.now());
      if (evicted) syncAggregates();
    }
    // Fire due timers: add their rules to agenda before fire cycle
    if (timerQueue) {
      const dueNames = timerQueue.advanceDueTimers(clock.now());
      for (const ruleName of dueNames) {
        const compiled = compiledRules.get(ruleName);
        if (compiled) {
          agenda.addActivation(compiled);
        }
      }
    }
    const tickResult = fire();
    // Restore suppressed expired rules for future ticks
    for (const [name, compiled] of suppressedRules) {
      compiledRules.set(name, compiled);
    }
    return tickResult;
  }

  function isVirtualClock(c: unknown): c is VirtualClock {
    return typeof (c as VirtualClock).setTime === "function";
  }

  function scheduleRule(ruleName: string, options: ScheduleOptions): void {
    assertNotDisposed();
    if (!clock || !timerQueue) {
      throw new ArbiterError(
        ArbiterErrorCode.INVALID_CLOCK_OPERATION,
        "Clock not configured. Pass { clock } in session config.",
      );
    }
    timerQueue.schedule(ruleName, options, clock.now());
  }

  function cancelSchedule(ruleName: string): void {
    assertNotDisposed();
    if (!clock || !timerQueue) {
      throw new ArbiterError(
        ArbiterErrorCode.INVALID_CLOCK_OPERATION,
        "Clock not configured. Pass { clock } in session config.",
      );
    }
    timerQueue.cancel(ruleName);
  }

  return {
    registerRule,
    removeRule,
    assert: assertPath,
    retract,
    fire,
    subscribe,
    update,
    getState,
    getPath,
    setFocus,
    dispose,
    assertFact,
    retractFact,
    getFacts,
    tick,
    scheduleRule,
    cancelSchedule,
  };
}
