# ADR: @ghost/arbiter — Rete-Inspired Production Rule Engine

## Status

**Proposed (2026-04-19)**

## Context

The Ghost platform needs a unified rule engine that powers:

1. **Form field visibility, validation, and calculation** — formbar's current rule engine is a brute-force fixed-point loop that re-evaluates all rules every iteration, has no truth maintenance, no conflict resolution beyond "throw on conflict," and no rule phasing.
2. **Shell contribution visibility** — plugin contributions (actions, menus, keybindings, layer surfaces) carry `when` clauses evaluated via a conjunction-only matcher with no boolean combinators, no priority, and no incremental re-evaluation.
3. **Business rule automation** — dynamic pricing, compliance, SLA monitoring, cross-entity validation. Currently no infrastructure exists for this.

A Rete-inspired production rule system unifies all three under one engine with incremental evaluation, truth maintenance, principled conflict resolution, and agenda-based rule phasing.

This document is normative. `MUST`, `SHOULD`, and `MAY` are used in the RFC 2119 sense.

## Decision Summary

Arbiter is a Rete-inspired production rule engine implemented as `@ghost/arbiter`, depending on `@ghost/predicate` for expression evaluation. It uses MongoDB query syntax for conditions (`when`), MongoDB update operators for actions (`then`), and MongoDB aggregation expressions for computed values. Implementation is scoped to Layer 1 (single-fact, TMS, agenda groups) and Layer 2 (multi-fact beta joins, accumulate). Layer 3 (temporal/CEP) is outlined for future work.

### Supersedes

This ADR supersedes formbar ADR sections 5.5 (Rule write constraints and conflict policy) and 5.6 (Convergence/fixed-point semantics). The `RuleDefinition`, `RuleWrite`, and `RuleWriteIntent` types in `@ghost/formbar-core/contracts.ts` are replaced by arbiter's `ProductionRule` and `ThenAction` types. The `ExpressionEngine` interface in formbar-core is replaced by direct arbiter session integration.

### Prior Art

- **Rete algorithm** (Forgy, 1979) — incremental pattern matching via alpha/beta discrimination networks
- **Drools** (JBoss) — agenda groups, activation groups, accumulate, salience, truth maintenance
- **Clara Rules** (Clojure) — immutable fact representation, accumulators as first-class nodes
- **MongoDB query language** — the authoring syntax model for `when`/`then`/values

---

## 1) Package Identity and Dependencies

```
@ghost/predicate          (exists — expression AST, compile, evaluate, operators, shorthand, collection)
       ^
@ghost/arbiter            (new — rule session, TMS, dependency network, agenda groups, match-resolve-act)
       ^
@ghost/formbar-core         (exists — creates arbiter session internally, schema-extracted rules)
```

`@ghost/arbiter` MUST depend on `@ghost/predicate` for expression evaluation.
`@ghost/arbiter` MUST NOT depend on `@ghost/formbar-core`, `@ghost/formbar-react`, or any shell code.
`@ghost/formbar-core` MUST depend on `@ghost/arbiter` and delegate all rule evaluation to it.

### 1.1 Package Exports

```
@ghost/arbiter            -> createSession, types, rule compiler
@ghost/arbiter/testing    -> createTestSession (stateless, synchronous, no TMS)
@ghost/arbiter/debug      -> explain(path), trace(), session inspector
```

### 1.2 Package Metadata

```json
{
  "name": "@ghost/arbiter",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./testing": { "types": "./src/testing/index.ts", "default": "./src/testing/index.ts" },
    "./debug": { "types": "./src/debug/index.ts", "default": "./src/debug/index.ts" }
  }
}
```

---

## 2) Rule Definition Contract (ProductionRule)

This is the canonical authoring and storage format. It MUST be JSON-serializable.

```ts
interface ProductionRule {
  readonly id: string;

  // MongoDB query shorthand — compiled to ExprNode internally.
  // Omit or {} = always active.
  readonly when?: ShorthandQuery;

  // MongoDB update operators — write actions when rule fires.
  readonly then: readonly ThenAction[];

  // Explicit deactivation actions. Presence disables TMS for this rule.
  readonly else?: readonly ThenAction[];

  // Higher salience fires first. Default 0.
  readonly salience?: number;

  // Agenda group name. Rule only evaluates when its group is active.
  readonly group?: string;

  // Activation group. First rule to fire in this group cancels all others.
  readonly activationGroup?: string;

  // Conflict behavior when another rule writes to the same path.
  // Default 'warn'.
  readonly onConflict?: 'override' | 'warn' | 'error';
}
```

### 2.1 ThenAction — MongoDB Update Operators

```ts
type ThenAction =
  | { readonly $set: Readonly<Record<string, ThenValue>> }
  | { readonly $unset: string | readonly string[] }
  | { readonly $merge: Readonly<Record<string, ThenValue>> }
  | { readonly $push: Readonly<Record<string, ThenValue>> }
  | { readonly $inc: Readonly<Record<string, number>> }
  | { readonly $activate: string }
  | { readonly $deactivate: string };
```

`` MUST write each key-value pair to the session scope. `` MUST delete the path(s). `` MUST shallow-merge the value into the existing object at the path. `` MUST append to the array at the path. `` MUST add the number to the existing numeric value at the path. ``/`` MUST activate/deactivate the named agenda group.

### 2.2 ThenValue — Expression Values

Values in ``, ``, `` MUST support:

```ts
type ThenValue =
  // Literals
  | string | number | boolean | null
  // Path reference (MongoDB $-prefix convention)
  | { readonly $path: string }
  // Aggregation / computation
  | { readonly $sum: string }
  | { readonly $count: string }
  | { readonly $min: string }
  | { readonly $max: string }
  | { readonly $avg: string }
  // Arithmetic
  | { readonly $add: readonly ThenValue[] }
  | { readonly $subtract: readonly [ThenValue, ThenValue] }
  | { readonly $multiply: readonly ThenValue[] }
  // String
  | { readonly $concat: readonly ThenValue[] }
  // Conditional
  | { readonly $cond: {
      readonly if: ShorthandQuery;
      readonly then: ThenValue;
      readonly else: ThenValue;
    }}
  // Filtered aggregation
  | { readonly $filter: {
      readonly input: string;
      readonly cond: ShorthandQuery;
    }};
```

Aggregation operators (``, ``, ``, ``, ``) MUST accept a wildcard path (e.g., `.*.weight`) and iterate over the collection. The `` operator MUST return the filtered sub-collection for use as input to an aggregation operator.

### 2.3 Path Syntax

Arbiter MUST support both path syntaxes:

- **MongoDB-style dot paths**: `lineItems.*.weight`, `.field.visible`, `address.city`
- **JSONPath**: `$.lineItems[*].weight`, `$['address']['city']`

The wildcard `*` (dot-path) and `[*]` (JSONPath) MUST iterate all elements of an array. Non-wildcard numeric segments MUST index into arrays.

### 2.4 Path Namespaces

Arbiter sessions operate on a flat scope (`Record<string, unknown>`). The following namespace conventions are defined:

| Namespace | Owner | TMS auto-retract default | Submitted (formbar) | Purpose |
|---|---|---|---|---|
| *(root)* | User input + rules | No | Yes | Form data / base facts |
| `` | Rules | Yes | No | Visibility, disabled, required, hints |
| `` | Rules | Configurable | No | Developer-defined derived/computed values |
| `` | Engine | No | No | Stage, dirty, submission status |
| `` | Rules (shell) | Yes | N/A | Contribution visibility |

Rules MAY write to any path including root. There are no enforced write restrictions by default. Consumers MAY configure writable namespaces via session options.

---

## 3) Session API

### 3.1 Session Creation

```ts
interface SessionConfig {
  // Session limits
  readonly limits?: {
    readonly maxRules?: number;
    readonly maxFacts?: number;
    readonly maxTmsEntries?: number;
    readonly maxFirings?: number;      // max firings per fire() call, default 1000
    readonly warnAt?: number;          // percentage threshold for warn-level alerts (0-1)
  };

  // Rule validation depth
  readonly ruleValidation?: 'strict' | 'syntax' | 'none';

  // Error behavior
  readonly errorMode?: 'strict' | 'lenient';

  // TMS configuration
  readonly tms?: {
    // Namespaces that auto-retract on rule deactivation
    readonly autoRetractNamespaces?: readonly string[]; // default ['$ui', '$contributions']
  };

  // Custom operators (unified registry — works in both when and then)
  readonly operators?: Readonly<Record<string, CustomOperatorFn>>;
}

function createSession(config?: SessionConfig): RuleSession;
```

### 3.2 Imperative API (Low-Level)

```ts
interface RuleSession {
  // Rule registration (supports incremental addition/removal on live sessions)
  registerRule(rule: ProductionRule): void;
  removeRule(ruleId: string): void;

  // Fact assertion (L1: single scope object, L2: typed facts)
  assert(scope: Record<string, unknown>): void;
  assertFact(type: string, fact: Record<string, unknown>): void;   // L2
  retractFact(type: string, factId: string): void;                  // L2

  // Fact type registration (L2 — optional TypeScript generics + optional Zod schema)
  registerFactType(type: string, schema?: unknown): void;           // L2

  // Execution
  fire(): FiringResult;

  // State reading
  get(path: string): unknown;
  getScope(): Readonly<Record<string, unknown>>;

  // Agenda group control
  activateGroup(name: string): void;
  deactivateGroup(name: string): void;
  readonly activeGroups: ReadonlySet<string>;

  // Lifecycle
  dispose(): void;

  // Error inspection (lenient mode)
  readonly errors: readonly ArbiterError[];
}
```

### 3.3 Reactive API (High-Level)

```ts
interface RuleSession {
  // Reactive: update triggers fire() automatically
  update(path: string, value: unknown): FiringResult;
  update(changes: Record<string, unknown>): FiringResult;

  // Subscribe to state changes
  subscribe(callback: (changes: readonly StateChange[]) => void): () => void;
  subscribe(path: string, callback: (value: unknown, prev: unknown) => void): () => void;
}
```

### 3.4 FiringResult

```ts
interface FiringResult {
  readonly rulesFired: number;
  readonly writes: readonly WriteRecord[];
  readonly errors: readonly ArbiterError[];
}

interface WriteRecord {
  readonly ruleId: string;
  readonly path: string;
  readonly value: unknown;
  readonly previousValue: unknown;
  readonly action: 'set' | 'unset' | 'merge' | 'push' | 'inc';
}

interface StateChange {
  readonly path: string;
  readonly value: unknown;
  readonly previousValue: unknown;
  readonly source: 'rule' | 'assert' | 'retract' | 'tms';
  readonly ruleId?: string;
}
```

---

## 4) Execution Model — Match-Resolve-Act Cycle

Arbiter MUST use a Rete-inspired match-resolve-act cycle. This supersedes formbar ADR section 5.6 (convergence/fixed-point).

### 4.1 The Cycle

```
1. MATCH  — Propagate scope changes through dependency network.
             Only re-evaluate rules whose read-dependencies include changed paths.
2. RESOLVE — Select one rule from the agenda (conflict set).
             Selection order: (a) highest salience, (b) most recently activated,
             (c) most specific condition (more terms in when).
3. ACT    — Fire the selected rule's then actions.
             Writes update the session scope, which may trigger
             re-evaluation of dependent rules (back to step 1).
4. REPEAT — Continue until agenda is empty (no rules ready to fire).
```

### 4.2 Refraction

Each rule instance MUST fire at most once per unique set of matching facts. A rule that has already fired for the current scope state MUST NOT fire again unless the scope changes in a way that re-satisfies its `when` condition (deactivation followed by re-activation).

### 4.3 Dependency Network

Arbiter MUST build a dependency graph at rule registration time by walking each rule's `when` and `then` expressions to extract read paths and write paths.

On scope change at path P, arbiter MUST re-evaluate only rules that:
- Read from path P (exact match), OR
- Read from a parent of P (e.g., rule reads `address`, change at `address.city`), OR
- Read from a child of P (e.g., rule reads `address.city`, change at `address`), OR
- Read from a wildcard that matches P (e.g., rule reads `lineItems.*.weight`, change at `lineItems.0.weight`)

For wildcard paths (`lineItems.*.weight`): arbiter SHOULD track dependencies at the wildcard-expanded level (`lineItems.*.weight` depends on any `lineItems.N.weight`). If precise wildcard tracking proves too complex, arbiter MAY fall back to conservative parent-level tracking (`lineItems.*`).

### 4.4 Conflict Resolution

When multiple rules are on the agenda simultaneously:

1. **Salience** — higher `salience` value fires first.
2. **Recency** — among equal salience, more recently activated fires first.
3. **Specificity** — among equal salience and recency, rule with more terms in `when` fires first.

When two rules write to the same path, behavior is controlled by `onConflict`:

- `'error'` — throw `ARBITER_WRITE_CONFLICT`.
- `'warn'` (default) — higher salience wins, emit warning trace.
- `'override'` — higher salience wins, silent.

If two rules with the SAME salience write different values to the same path and `onConflict` is not `'override'`, arbiter MUST throw `ARBITER_WRITE_CONFLICT`.

### 4.5 Safety Limits

Arbiter MUST enforce a maximum firing count per `fire()` call to prevent runaway rule chains. Default: 1000 firings. Configurable via `SessionConfig.limits.maxFirings`. On breach: throw `ARBITER_MAX_FIRINGS_EXCEEDED`.

---

## 5) Truth Maintenance System (TMS)

### 5.1 Justification Records

Every write produced by a rule firing MUST be tracked as a `TmsJustification`:

```ts
interface TmsJustification {
  readonly ruleId: string;
  readonly path: string;
  readonly currentValue: unknown;
  readonly previousValue: unknown; // snapshot before this rule wrote
  readonly firedAt: number;        // firing sequence number
}
```

### 5.2 Auto-Retraction

When a rule's `when` condition becomes false (the rule deactivates):

- If the rule has an explicit `else` clause: execute the `else` actions. TMS does NOT auto-retract.
- If the rule has no `else` clause AND the write path is in an auto-retract namespace (default: ``, ``): restore the `previousValue` from the justification record.
- If the rule has no `else` clause AND the write path is NOT in an auto-retract namespace: the write persists. No auto-retraction.

### 5.3 Configurable Auto-Retract Namespaces

The `tms.autoRetractNamespaces` session option controls which namespaces auto-retract. Default: `['', '']`. Setting to `['', '', '', '']` (empty string = root) enables auto-retract for all writes.

### 5.4 Retraction Cascading

When TMS retracts a write to path P, this constitutes a scope change at P, which triggers dependency network re-evaluation. Rules that read from P MUST be re-evaluated. This may cause further rule deactivations and retractions (cascading retraction).

---

## 6) Agenda Groups

### 6.1 Definition

An agenda group is a named partition of rules. Only rules in currently active groups are eligible for the agenda. Rules with no `group` are in the implicit default group, which is always active.

### 6.2 Activation Modes

Agenda groups MUST support three activation modes:

**Stage-bound**: groups auto-activate/deactivate based on `$meta.stage`:
```ts
session.bindGroupToStage('submit-gate', 'submit');
// 'submit-gate' group activates when $meta.stage === 'submit'
```

**API-driven**: explicit control:
```ts
session.activateGroup('compliance-checks');
session.deactivateGroup('compliance-checks');
```

**Rule-driven**: rules can activate groups via the `$activate`/`$deactivate` then-actions:
```ts
{
  id: 'activate-compliance',
  when: { 'route.region': { $in: ['EU', 'US'] } },
  then: [{ $activate: 'compliance-checks' }]
}
```

### 6.3 Activation Groups (Mutual Exclusion)

Rules with the same `activationGroup` are mutually exclusive. When one rule in the activation group fires, all other rules in the same activation group are removed from the agenda for the current cycle. This implements "first match wins" semantics.

---

## 7) Operator Model

### 7.1 Unified Registry

Arbiter MUST use a single operator registry shared between condition evaluation (`when`) and value computation (`then` values). Custom operators are registered once and usable in both contexts.

```ts
type CustomOperatorFn = (args: unknown[], scope: Record<string, unknown>) => unknown;
```

In a `when` context, the operator's return value is coerced to boolean. In a `then` value context, the return value is used as-is.

### 7.2 Built-in Condition Operators (from @ghost/predicate)

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$regex`, `$and`, `$or`, `$not`

### 7.3 Built-in Expression Operators (new in @ghost/arbiter)

| Operator | Signature | Description |
|---|---|---|
| `$sum` | `string` (wildcard path) | Sum numeric values in collection |
| `$count` | `string` (path to array) | Count items in collection |
| `$min` | `string` (wildcard path) | Minimum value in collection |
| `$max` | `string` (wildcard path) | Maximum value in collection |
| `$avg` | `string` (wildcard path) | Average of numeric values |
| `$add` | `ThenValue[]` | Sum of arguments |
| `$subtract` | `[ThenValue, ThenValue]` | First minus second |
| `$multiply` | `ThenValue[]` | Product of arguments |
| `$concat` | `ThenValue[]` | String concatenation |
| `$cond` | `{ if, then, else }` | Conditional expression |
| `$filter` | `{ input, cond }` | Filter collection by predicate |

---

## 8) Authoring Surfaces

Four authoring surfaces compile to the same `ProductionRule` format.

### 8.1 Standalone Rules (TypeScript / JSON)

Direct `ProductionRule` objects. Used for form-level rules, business rules, and config-service-stored rules.

```ts
const rules: ProductionRule[] = [
  {
    id: 'hazmat-fields',
    when: { cargoType: 'hazardous' },
    then: [
      { $set: {
        '$ui.imoClass.visible': true,
        '$ui.imoClass.required': true,
        '$ui.unNumber.visible': true,
      }},
    ],
    group: 'visibility',
  },
  {
    id: 'total-weight',
    then: [
      { $set: { totalWeight: { $sum: '$lineItems.*.weight' } } },
    ],
    group: 'calculation',
    salience: 100,
  },
];
```

### 8.2 Zod Hints

Field-level shorthand extracted by `@ghost/formbar-from-schema`:

```ts
const schema = z.object({
  cargoType: z.enum(['general', 'hazardous', 'reefer']),
  imoClass: z.string().meta({
    formbar: {
      visible: { cargoType: 'hazardous' },
      required: { cargoType: 'hazardous' },
    },
  }),
  totalWeight: z.number().meta({
    formbar: {
      compute: { $sum: '$lineItems.*.weight' },
      readOnly: true,
    },
  }),
});
```

The extractor MUST generate `ProductionRule[]` from hints:

| Hint Key | Type | Generated Rule |
|---|---|---|
| `visible` | `ShorthandQuery` or `boolean` | `when`, `then: [{ $set: { '$ui.<path>.visible': true } }]`, TMS on |
| `required` | `ShorthandQuery` or `boolean` | `when`, `then: [{ $set: { '$ui.<path>.required': true } }]`, TMS on |
| `disabled` | `ShorthandQuery` or `boolean` | `when`, `then: [{ $set: { '$ui.<path>.disabled': true } }]`, TMS on |
| `readOnly` | `ShorthandQuery` or `boolean` | `when`, `then: [{ $set: { '$ui.<path>.readOnly': true } }]`, TMS on |
| `compute` | `ThenValue` | `then: [{ $set: { '<path>': <expr> } }]`, group: 'calculation' |
| `ui` | `Record<string, ThenValue>` | `then: [{ $set: { '$ui.<path>.<key>': <value> } }]` per entry |

Schema-extracted rules MUST receive salience `0` by default.

### 8.3 JSON Schema x-formbar

Same hint vocabulary, different carrier:

```json
{
  "properties": {
    "imoClass": {
      "type": "string",
      "x-formbar": {
        "visible": { "cargoType": "hazardous" },
        "required": { "cargoType": "hazardous" }
      }
    }
  }
}
```

Extraction logic MUST produce identical `ProductionRule[]` as the Zod path.

### 8.4 Plugin Contribution `when` Clauses

Plugin contributions in `package.json` already use MongoDB shorthand:

```json
{
  "ghost": {
    "contributes": {
      "actions": [{
        "id": "assign-to-vessel",
        "intent": "domain.entity.assign",
        "when": {
          "selection.entityType": "order",
          "selection.count": { "$gte": 1 }
        }
      }]
    }
  }
}
```

The shell MUST compile each contribution's `when` clause into a `ProductionRule`:

```ts
{
  id: 'contribution:action:assign-to-vessel',
  when: { 'selection.entityType': 'order', 'selection.count': { $gte: 1 } },
  then: [{ $set: { '$contributions.assign-to-vessel.active': true } }],
  // TMS: auto-retracts when condition becomes false
}
```

The field name MUST be unified to `when` across all contribution types. The current `predicate` field on `PluginActionContribution` MUST be renamed to `when`.

---

## 9) formbar-core Integration

### 9.1 Session Lifecycle

`createForm()` MUST accept an optional pre-configured arbiter session. If none is provided and rules exist (from schema extraction or explicit options), `createForm()` MUST create an arbiter session internally.

```ts
interface CreateFormOptions<S extends string = string> {
  // ... existing options ...
  rules?: readonly ProductionRule[];
  session?: RuleSession;  // pre-configured session
}
```

### 9.2 Pipeline Integration

Step 7 of the normative runtime algorithm (formbar ADR section 8) — "Evaluate expressions and rules" — MUST delegate to `session.update()` instead of the legacy `executeRules()` convergence loop.

The integration MUST:
1. Before step 7: `session.assert(buildExpressionScope(state))` to sync form state into the arbiter session scope.
2. Step 7: `session.fire()` to run the match-resolve-act cycle.
3. After step 7: read `session.getScope()` and apply scope changes back to `FormState` (route `$ui.*` to `uiState`, root paths to `data`, `$state.*` to a state bucket).

### 9.3 Submission

When the form submits, the payload MUST include only root data by default. `$ui`, `$state`, `$meta`, and `$contributions` namespaces MUST be excluded from the submission payload unless the developer explicitly configures inclusion.

---

## 10) Shell Integration

### 10.1 Session Model

The shell MUST use a hybrid session model:

- **One global session** for contribution visibility. Contribution `when` rules are registered on plugin activation. Shell context facts (selection, navigation, user) are updated on context change.
- **Ephemeral sessions** for specific contexts (e.g., an entity detail panel with its own rule set). Created and disposed with the context lifecycle.

### 10.2 Contribution Visibility

The global session scope includes:

```ts
{
  selection: { entityType: string, count: number, items: unknown[] },
  navigation: { currentView: string, params: Record<string, unknown> },
  user: { role: string, tenant: string, permissions: string[] },
  $contributions: { [contributionId: string]: { active: boolean } },
}
```

When `session.update('selection', newSelection)` is called, arbiter incrementally re-evaluates only contribution rules that depend on `selection.*` paths.

---

## 11) Rule Hot-Reload

Arbiter MUST support incremental rule addition and removal on live sessions.

### 11.1 Addition

`session.registerRule(rule)` on a live session MUST:
1. Compile the rule's `when` clause and add nodes to the dependency network.
2. Evaluate the rule against the current scope.
3. If the rule matches, add it to the agenda and fire.

### 11.2 Removal

`session.removeRule(ruleId)` on a live session MUST:
1. Remove the rule from the dependency network.
2. If the rule was active, retract all TMS-justified writes from that rule (using the snapshot `previousValue` for each).
3. Retraction may trigger cascading re-evaluation.

---

## 12) Explainability

### 12.1 Path Explanation

```ts
session.explain('$ui.imoClass.visible')
```

MUST return:

```ts
interface Explanation {
  readonly path: string;
  readonly currentValue: unknown;
  readonly source: 'rule' | 'assert' | 'default';
  readonly ruleId?: string;
  readonly ruleName?: string;
  readonly when?: ShorthandQuery;
  readonly matchedFacts?: Record<string, unknown>;
  readonly firedAt?: number;
}
```

### 12.2 Session Trace

```ts
session.trace()
```

MUST return the full firing history:

```ts
interface SessionTrace {
  readonly firings: readonly FiringRecord[];
}

interface FiringRecord {
  readonly sequence: number;
  readonly ruleId: string;
  readonly when: ShorthandQuery;
  readonly matchedScope: Record<string, unknown>;
  readonly writes: readonly WriteRecord[];
  readonly tmsRetractions: readonly WriteRecord[];
}
```

---

## 13) Error Codes

| Code | Meaning |
|---|---|
| `ARBITER_WRITE_CONFLICT` | Two rules at same salience wrote different values to same path |
| `ARBITER_MAX_FIRINGS_EXCEEDED` | Firing count exceeded limit (likely circular rules) |
| `ARBITER_RULE_COMPILE_ERROR` | Rule `when` or `then` failed to compile |
| `ARBITER_INVALID_PATH` | Path in `when` or `then` is malformed |
| `ARBITER_UNKNOWN_OPERATOR` | Operator not in registry |
| `ARBITER_TYPE_MISMATCH` | Operator received wrong argument type |
| `ARBITER_LIMIT_EXCEEDED` | Session limit (rules, facts, TMS entries) exceeded |
| `ARBITER_GROUP_NOT_FOUND` | Attempted to activate/deactivate unknown group |
| `ARBITER_INVALID_FACT_TYPE` | L2: asserted fact doesn't match registered schema |
| `ARBITER_JOIN_ERROR` | L2: beta join failed |
| `ARBITER_AGGREGATE_ERROR` | Aggregation operator on non-array or non-numeric |
| `ARBITER_PROTOTYPE_POLLUTION` | Path contains `__proto__`, `constructor`, or `prototype` |

In `strict` error mode: all errors throw.
In `lenient` error mode: non-critical errors are collected on `session.errors`, rule is skipped, execution continues.

---

## 14) Layer 2 — Multi-Fact Reasoning

### 14.1 Fact Type Registration

```ts
session.registerFactType('order', orderZodSchema);  // optional schema for validation
session.registerFactType<Vessel>('vessel');           // TypeScript-only, no runtime validation
```

### 14.2 Fact Assertion

```ts
session.assertFact('order', { id: 'o-1', status: 'confirmed', weight: 5000 });
session.assertFact('vessel', { id: 'v-1', maxWeight: 50000, loadFactor: 0.87 });
```

Each fact MUST carry a `$type` discriminator internally. Facts are stored in typed alpha memories.

### 14.3 Beta Join Syntax (Design Deferred)

The `when` clause syntax for cross-fact join conditions is NOT finalized. This section records the candidate designs evaluated and the decision criteria for L2 implementation.

**Candidate A — Explicit `$join` operator:**
```ts
{
  when: {
    '$type': 'order',
    status: 'confirmed',
    $join: { type: 'customer', on: { customerId: '$customer.id' } }
  }
}
```
Pro: explicit about what's a join. Con: deeply nested, unfamiliar to MongoDB users.

**Candidate B — Implicit multi-fact matching (Drools-style):**
```ts
{
  when: {
    order: { status: 'confirmed' },
    customer: { id: { $eq: '$order.customerId' }, tier: 'enterprise' }
  }
}
```
Pro: reads naturally ("when there's an order and a customer where..."). Con: ambiguous — how does the engine distinguish a fact-type key from a field path key?

**Candidate C — `$match` array (aggregation-pipeline-inspired):**
```ts
{
  when: [
    { $match: { '$type': 'order', status: 'confirmed' } },
    { $lookup: { from: 'customer', localField: 'customerId', foreignField: 'id', as: 'customer' } },
    { $match: { 'customer.tier': 'enterprise' } }
  ]
}
```
Pro: mirrors MongoDB aggregation pipeline exactly. Con: `when` changes from object to array, breaking L1 contract.

**Decision criteria for L2:**
- MUST NOT break L1 `ShorthandQuery` compatibility (object-based `when`).
- MUST clearly distinguish intra-fact conditions (alpha) from inter-fact conditions (beta).
- SHOULD feel familiar to developers who know MongoDB.
- SHOULD support variable bindings across facts (e.g., `order.customerId === customer.id`).
- SHOULD support negation joins ("no order exists where...").
- The session API (`registerFactType`, `assertFact`, `retractFact`) MUST be implemented in L1 as no-op stubs to ensure the interface is stable when L2 syntax is finalized.

### 14.4 Accumulate Nodes

Accumulate operators (`$sum`, `$count`, `$min`, `$max`, `$avg`) over fact collections. Updated incrementally when facts are asserted/retracted.

---

## 15) Layer 3 — Temporal / CEP (Deferred — Scope and Considerations)

Layer 3 is NOT in scope for implementation. This section outlines the design direction, key use cases that will drive L3 requirements, open questions, and constraints that L1/L2 MUST respect to avoid painting L3 into a corner.

### 15.1 Motivation

The maritime logistics domain has strong temporal requirements:
- SLA monitoring: "if no loading event within 4 hours of confirmation, escalate"
- Schedule conflict detection: overlapping vessel arrival windows at the same berth
- Trend analysis: "average port turnaround over last 30 days"
- Regulatory deadlines: "customs declaration must be filed 24h before arrival"

These patterns require reasoning over TIME, not just current state. L1/L2 reason over "what IS true now." L3 reasons over "what HAPPENED, when, and in what sequence."

### 15.2 Sliding Time Windows

Rules SHOULD be able to specify temporal windows: "events in the last N minutes/hours." Facts SHOULD carry timestamps. The session SHOULD support automatic fact expiration based on window boundaries.

**Open question**: Should windows be wall-clock time (real-time monitoring) or logical time (replay/simulation)? Enterprise SaaS likely needs both — real-time for operations, logical for audit/testing.

**L1/L2 constraint**: Facts SHOULD include an optional `$timestamp` field. L1/L2 MUST NOT reject facts with `$timestamp` — they simply ignore it. This ensures L3 can be layered on without fact schema changes.

### 15.3 Temporal Operators

Future operators: `$after`, `$before`, `$during`, `$meets`, `$overlaps`, `$within`. These enable pattern detection over event sequences.

**Open question**: Allen's interval algebra defines 13 temporal relations. Which subset is worth implementing? Likely: `$before`, `$after`, `$within`, `$overlaps` cover 90% of logistics use cases.

### 15.4 Absence Detection

"If expected event does NOT occur within SLA window, fire rule." Requires a timer mechanism integrated with the session lifecycle.

**Key design challenge**: Absence detection requires the engine to fire a rule based on something NOT happening. This is fundamentally different from L1/L2 where rules fire based on conditions becoming true. Options:
- External timer service sends "timeout" facts that trigger regular rules
- Built-in `$absent` operator with session-managed timers
- Hybrid: session provides a `scheduleCheck(ruleId, delay)` API

**L1/L2 constraint**: The `$not` operator in `when` clauses (from predicate) handles logical negation ("this fact does NOT exist"). L3 absence detection is temporal negation ("this fact did NOT arrive within N seconds"). These are different concepts and MUST NOT be conflated.

### 15.5 Event Correlation

Join events from different streams by shared attributes within temporal windows. Extension of L2 beta joins with temporal constraints.

Example: "correlate vessel AIS position events with weather alert events where the vessel's position is within the alert area and both events are within the last 6 hours."

**L1/L2 constraint**: L2 beta join infrastructure SHOULD be designed to accept optional temporal constraints as a future extension point without structural changes to the join node model.

### 15.6 Event Streams vs State Facts

L1/L2 facts are STATE — they represent what is currently true. L3 introduces EVENTS — things that happened at a point in time. Events are immutable (they happened) while state facts are mutable (they change).

**Open question**: Should events and state facts live in the same working memory, or separate? Drools uses `@role(event)` annotation to distinguish them. This affects garbage collection — state facts persist, events expire after their window closes.

### 15.7 Performance Considerations

Temporal pattern matching over event streams can be expensive:
- Sliding windows require maintaining sorted event buffers
- Absence detection requires timer infrastructure
- Event correlation is O(events^2) in the naive case

**Recommendation**: L3 should be an optional session capability (`createSession({ temporal: true })`) that adds the timer and event buffer infrastructure only when needed.

### 15.8 What L1/L2 MUST Preserve for L3

1. Facts MAY carry `$timestamp: number` (epoch ms) without rejection.
2. The dependency network MUST be extensible to accept temporal constraint nodes.
3. The `ThenAction` union MUST be extensible (no exhaustive switch without a default).
4. The `SessionConfig` MUST accept unknown extension keys without rejection.
5. The firing history (`trace()`) MUST include timestamps per firing for future temporal replay.

---


## 16) Testing Strategy

### 16.1 Unit Tests

Each module MUST have dedicated tests:
- Rule compilation (shorthand to internal representation)
- Then compilation (update operators to write actions)
- Expression operators (all 11 built-in expression operators)
- Dependency network (path matching, wildcard expansion)
- Match-resolve-act cycle (firing order, refraction, agenda empty)
- TMS (snapshot, retract, cascade, else-disables-TMS)
- Agenda groups (activate, deactivate, stage-bound, rule-driven)
- Conflict resolution (salience, onConflict modes)
- Session API (imperative + reactive)
- Hot reload (add, remove, TMS retraction on removal)
- Error handling (strict vs lenient modes)
- Explainability (explain path, session trace)

### 16.2 Conformance Tests

A conformance suite MUST verify:
- C1: MongoDB shorthand compiles correctly for all operator combinations
- C2: Match-resolve-act fires rules in salience order
- C3: TMS auto-retracts $ui writes on rule deactivation
- C4: TMS restores snapshot previousValue (not undefined)
- C5: Explicit else disables TMS for that rule
- C6: Agenda groups partition rule evaluation
- C7: Activation groups enforce mutual exclusion
- C8: Dependency network only re-evaluates affected rules
- C9: Wildcard paths trigger correct re-evaluation
- C10: Hot reload adds/removes rules incrementally
- C11: Prototype pollution rejected in all path resolution

### 16.3 Integration Tests

- formbar-core creates session, registers schema-extracted rules, pipeline step 7 delegates to session
- Shell global session handles contribution visibility with incremental context updates

---

## 17) Security

### 17.1 Prototype Pollution

All path resolution MUST reject segments matching `__proto__`, `constructor`, or `prototype`. Reuse `assertSafeSegment` from `@ghost/predicate/safe-path.ts`.

### 17.2 Recursion Depth

Expression evaluation and rule compilation MUST enforce a maximum recursion depth (default 256). Reuse existing depth guards from `@ghost/predicate`.

### 17.3 Operator Sandboxing

Custom operators receive evaluated arguments only — they MUST NOT have access to the raw AST or the session internals.

---

## 18) Performance Targets

| Scenario | Target |
|---|---|
| 50 rules, single-fact, single field change | < 1ms |
| 200 contribution rules, context change affecting 10 rules | < 2ms |
| 500 rules, 100 facts (L2), single fact change | < 10ms |
| Hot reload: add 1 rule to 200-rule session | < 1ms |

Benchmarks MUST be included in the test suite for regression tracking.

---

## 19) File Structure

```
packages/arbiter/
  package.json
  tsconfig.json
  src/
    index.ts                    # barrel: createSession, types
    contracts.ts                # ProductionRule, ThenAction, ThenValue, SessionConfig
    session.ts                  # createSession, RuleSession implementation
    rule-compiler.ts            # ProductionRule -> CompiledRule (internal)
    then-compiler.ts            # ThenAction -> WriteAction (internal)
    expression-ops.ts           # $sum, $avg, $cond, $multiply, etc.
    dependency-network.ts       # Alpha nodes, push-based propagation
    agenda.ts                   # Agenda, conflict resolution, salience sort
    tms.ts                      # Truth maintenance: justify, retract, cascade
    scope.ts                    # Scope read/write, namespace routing
    path-utils.ts               # Wildcard expansion, JSONPath support
    errors.ts                   # ArbiterError, all error codes
    testing/
      index.ts                  # createTestSession
    debug/
      index.ts                  # explain, trace
    __tests__/
      rule-compiler.test.ts
      then-compiler.test.ts
      expression-ops.test.ts
      dependency-network.test.ts
      agenda.test.ts
      tms.test.ts
      session.test.ts
      session-reactive.test.ts
      hot-reload.test.ts
      conflict-resolution.test.ts
      explainability.test.ts
      security.test.ts
      conformance.test.ts
      benchmark.test.ts
```

---

## 20) Consequences

### Positive

- **One engine, many consumers**: forms, intents, config, workflows, alerts all share the same engine.
- **Incremental evaluation**: O(delta) vs O(rules x iterations) per change.
- **Truth maintenance**: eliminates ghost state from stale rule writes.
- **Principled conflict resolution**: deterministic, configurable, auditable.
- **Explainability**: every derived value has a justification chain.
- **Hot-swappable rules**: change business rules without deployment.
- **MongoDB familiarity**: developers already know the query syntax.

### Negative

- **Implementation complexity**: Rete is significantly harder than a simple evaluate-all loop.
- **Memory overhead**: TMS justification records and dependency network nodes consume memory.
- **Learning curve**: team must understand production rule concepts.
- **No ecosystem**: no mature TypeScript Rete library exists; this is a build-not-buy decision.

### Risks

- **Over-engineering for simple forms**: mitigated by Layer 1 being a modest evolution.
- **Performance cliff with poorly written rules**: mitigated by configurable firing limits and dependency network pruning.
- **Debugging opacity**: mitigated by explain/trace APIs from day one.
