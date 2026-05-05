# @ghost/arbiter

A Rete-inspired production rule engine using MongoDB query syntax for conditions and update operators for actions.

## Overview

Arbiter powers reactive rule evaluation across the Ghost platform:

- **formbar**: Form field visibility, validation, and calculated values
- **Shell**: Plugin contribution visibility (`when` clauses on actions, menus, keybindings)
- **Future**: Business rule automation

It uses `@ghost/predicate` for MongoDB-style condition matching and supports MongoDB aggregation expressions (`$sum`, `$avg`, `$cond`, etc.) for computed values.

## Quick Start

```typescript
import { createSession } from '@ghost/arbiter';
import type { ProductionRule } from '@ghost/arbiter';

const rules: ProductionRule[] = [
  {
    name: 'show-discount',
    when: { 'cart.total': { $gte: 100 } },
    then: [{ $set: { '$ui.discount.visible': true } }],
    salience: 10,
  },
  {
    name: 'calc-tax',
    when: { 'cart.total': { $exists: true } },
    then: [
      {
        $set: {
          '$state.tax': { $multiply: ['$cart.total', 0.08] },
        },
      },
    ],
  },
];

const session = createSession({ rules });

// Assert data and fire rules
session.assert('cart.total', 150);
const result = session.fire();

console.log(session.getPath('$ui.discount.visible')); // true
console.log(session.getPath('$state.tax'));            // 12
console.log(result.rulesFired);                        // ['show-discount', 'calc-tax']

// Reactive shorthand: assert + fire in one call
session.update('cart.total', 50);
console.log(session.getPath('$ui.discount.visible')); // auto-retracted by TMS

// Custom operators
const customSession = createSession({
  rules: [...],
  thenOperators: myRegistry,  // for custom $action, $notify, etc.
});

// Subscribe to changes
const unsub = session.subscribe('$state.tax', (value) => {
  console.log('Tax changed:', value);
});

session.dispose();
```

## Architecture

### Match-Resolve-Act Cycle

1. **Match** — Evaluate all rule conditions against working memory
2. **Resolve** — Select the highest-salience activation from the agenda
3. **Act** — Execute the selected rule's actions (mutations)
4. **Re-evaluate** — Propagate changes through the alpha network to affected rules
5. **Repeat** — Continue until the agenda is empty (quiescent)

### Alpha Network

Field-to-rule indexing with wildcard path support enables push-based change propagation. When a fact changes, only rules that reference the affected paths are re-evaluated.

### Agenda & Conflict Resolution

Activations are ordered by:

1. **Salience** — Higher fires first (default: 0)
2. **Recency** — More recently activated rules preferred
3. **Specificity** — More specific conditions preferred

Activation groups partition the agenda. Use `setFocus(group)` or the `focus` action to control which group fires next. Groups are managed as a focus stack.

### Truth Maintenance System (TMS)

When a rule's conditions become false, TMS automatically retracts the writes that rule produced. Values revert to their snapshot (the value before the rule wrote), not `undefined`.

TMS is configurable per-namespace:

- `'ui-contributions'` (default) — Auto-retract enabled for `$ui` and `$contributions`
- `'all'` — Auto-retract enabled for all namespaces

Rules with an `else` clause disable TMS for that rule (explicit else replaces auto-retract).

### Namespaces

| Namespace | Purpose | TMS |
|---|---|---|
| *(root)* | Application data | No (by default) |
| `$ui` | UI-derived state | Yes |
| `$state` | Computed/derived values | No (by default) |
| `$meta` | Engine metadata | No |
| `$contributions` | Shell plugin contributions | Yes |

### Security

- **Prototype pollution prevention** — Paths like `__proto__`, `constructor`, `prototype` are rejected
- **Recursion limits** — Configurable `maxCycles` and `maxRuleFirings`
- **Operator sandboxing** — Custom operators run in a controlled context
- **Validation modes** — `strict` (full validation), `syntax` (structure only), `none` (skip)

## API Reference

### Exports

```
@ghost/arbiter          — createSession() + all types
@ghost/arbiter/testing  — createTestSession, fireWith, assertRuleFired, assertRuleNotFired, assertState
@ghost/arbiter/debug    — explainResult, formatChanges, dumpState
```

### `createSession(config?: SessionConfig): RuleSession`

Creates a new rule session.

```typescript
interface SessionConfig {
  readonly rules?: readonly ProductionRule[];
  readonly initialState?: Readonly<Record<string, unknown>>;
  readonly operators?: OperatorRegistryConfig;
  readonly limits?: SessionLimits;
  readonly tms?: TmsConfig;                       // 'ui-contributions' | 'all'
  readonly validation?: 'strict' | 'syntax' | 'none';
  readonly errorHandling?: 'strict' | 'lenient';
}
```

### RuleSession

```typescript
interface RuleSession {
  // Imperative API
  registerRule(rule: ProductionRule): void;
  removeRule(name: string): void;
  assert(path: string, value: unknown): void;
  retract(path: string): void;
  fire(): FiringResult;

  // Reactive API
  subscribe(path: string, callback: SubscriptionCallback): Unsubscribe;
  update(path: string, value: unknown): FiringResult;  // assert + fire

  // State inspection
  getState(): Readonly<Record<string, unknown>>;
  getPath(path: string): unknown;

  // Agenda control
  setFocus(group: string): void;

  // Lifecycle
  dispose(): void;
}
```

### ProductionRule

```typescript
interface ProductionRule {
  readonly name: string;
  readonly when: Record<string, unknown>;        // MongoDB query syntax
  readonly then: readonly ThenStage[];            // Pipeline-style mutations
  readonly else?: readonly ThenStage[];           // Disables TMS for this rule
  readonly salience?: number;                     // Priority (default: 0)
  readonly activationGroup?: string;              // Agenda group name
  readonly onConflict?: 'override' | 'warn' | 'error';
  readonly enabled?: boolean;                     // Default: true
  readonly description?: string;
}
```

### Action Types (Pipeline Syntax)

Actions use MongoDB pipeline-style update operators:

| Operator | Description | Example |
|---|---|---|
| `$set` | Set one or more paths | `{ $set: { '$ui.visible': true, count: 5 } }` |
| `$unset` | Remove paths | `{ $unset: { '$ui.visible': '' } }` |
| `$push` | Push a value onto an array | `{ $push: { items: 'new' } }` |
| `$pull` | Remove matching items from an array | `{ $pull: { items: { id: 'old' } } }` |
| `$inc` | Increment a numeric value | `{ $inc: { count: 1 } }` |
| `$merge` | Shallow merge an object into a path | `{ $merge: { config: { a: 1 } } }` |
| `$focus` | Set the active agenda group | `{ $focus: { group: 'validation' } }` |

Multiple paths can be set in a single stage: `{ $set: { a: 1, b: 2, '$ui.visible': true } }`

### Expression Operators

Values in `$set`, `$push`, `$inc`, and `$merge` actions can use MongoDB aggregation expressions:

**Arithmetic**: `$sum`, `$multiply`, `$divide`, `$subtract`, `$round`, `$ceil`, `$floor`
**Aggregation**: `$avg`, `$min`, `$max`
**Conditional**: `$cond`, `$ifNull`, `$switch`
**String**: `$concat`
**Type conversion**: `$toNumber`, `$toString`, `$toBool`
**Literal**: `$literal`

```typescript
// Computed value example
{
  $set: {
    '$state.total': { $sum: ['$lineItems.price', '$lineItems.tax'] },
  },
}
```

### Error Codes

| Code | Description |
|---|---|
| `ARBITER_RULE_COMPILATION_FAILED` | Rule condition or action failed to compile |
| `ARBITER_INVALID_PATH` | Path is malformed or targets a protected property |
| `ARBITER_INVALID_OPERATOR` | Unknown or misconfigured operator |
| `ARBITER_CYCLE_LIMIT_EXCEEDED` | Match-resolve-act loop exceeded `maxCycles` |
| `ARBITER_FIRING_LIMIT_EXCEEDED` | Total rule firings exceeded `maxRuleFirings` |
| `ARBITER_WRITE_CONFLICT` | Multiple rules wrote to the same path |
| `ARBITER_TMS_RETRACT_FAILED` | TMS could not retract a previous write |
| `ARBITER_INVALID_NAMESPACE` | Path targets an unknown namespace |
| `ARBITER_SESSION_DISPOSED` | Operation on a disposed session |
| `ARBITER_PROTOTYPE_POLLUTION` | Path attempted prototype pollution |
| `ARBITER_EXPRESSION_EVAL_FAILED` | Expression evaluation error |
| `ARBITER_RULE_NOT_FOUND` | Referenced rule does not exist |

### Multi-Fact Support (L2)

Arbiter supports fact type registration and working memory CRUD with accumulate nodes (`sum`, `count`, `min`, `max`, `avg`). Beta join syntax for cross-fact pattern matching is TBD.

## Testing

```typescript
import { createTestSession, fireWith, assertRuleFired, assertState } from '@ghost/arbiter/testing';

const rules = [myRule];
const session = createTestSession(rules, { quantity: 5 });

const result = session.fire();
assertRuleFired(result, 'my-rule');
assertState(session, '$state.total', 100);

// Or use fireWith for one-shot evaluation
const result2 = fireWith(rules, { quantity: 10 });
assertRuleFired(result2, 'my-rule');
```

## Debugging

```typescript
import { explainResult, formatChanges, dumpState } from '@ghost/arbiter/debug';

const result = session.fire();
console.log(explainResult(result));
console.log(formatChanges(result));
console.log(dumpState(session));
```

## Performance

| Scenario | Measured | Target |
|---|---|---|
| 50-rule form fire | ~3.6–5.1ms | <5ms |
| 200-rule contributions fire | ~4.0–5.3ms | <10ms |
| 1000 field updates | ~6.7–9.0ms | <50ms |

270 tests, 0 failures.

## Dependencies

- `@ghost/predicate` — Expression evaluation engine (`compileShorthand`, `evaluate`, `ExprNode`)

## Remaining Work

1. **L3: Business rule automation** — Temporal operators (`$before`, `$after`, `$within`), event-condition-action rules, cross-session fact sharing. Outlined in ADR only, not scoped for implementation.

2. **Beta join syntax decision** — Three candidate syntaxes for multi-fact joins exist in `beta-join-stubs.ts`. Decision deferred pending real use cases. Required for full L2 cross-fact pattern matching.

3. **formbar-from-schema: Generate ProductionRule[]** — Schema extractors in `@ghost/formbar-from-schema` should produce `ProductionRule[]` from Zod hints and JSON Schema `x-formbar` extensions, replacing old `RuleDefinition[]` output.

4. **Old rule engine deprecation** — `RuleDefinition`, `executeRules()`, `expression-deps.ts` still present in `@ghost/formbar-core` for backward compatibility. Should be deprecated and removed once all consumers migrate to arbiter.

5. **Shell arbiter session** — Full hybrid session model for shell contribution visibility: one global session for static contributions + ephemeral sessions for context-dependent visibility. Currently using `@ghost/predicate` directly, but an arbiter session would enable TMS auto-retract and cross-contribution dependencies.

6. **plugin-contracts $exists/comparison operator test failures** — 8 pre-existing test failures in `predicate.test.ts` for `$exists`, `$gt/$gte/$lt/$lte` operators. Predates arbiter work; likely a `@ghost/predicate` or test fixture issue.
