# Beta Join Guide

Multi-fact pattern matching and join semantics for `@ghost-shell/arbiter`.

## Overview

Beta join enables rules to match across multiple facts simultaneously. Instead of rules that only evaluate scope conditions (`when`), you can define **patterns** that match typed facts in working memory and **join** them on shared fields. When all patterns in a rule are satisfied, the rule fires with bound fact data available in actions.

This unlocks:
- Cross-entity correlation (e.g., matching an Order to its Customer)
- Multi-fact reasoning with automatic join evaluation
- Truth Maintenance System (TMS) integration — retracting any contributing fact automatically reverts the rule's writes

## Quick Start

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "Order", fields: { status: "string", amount: "number", customerId: "string" } },
    { name: "Customer", fields: { id: "string", tier: "string" } },
  ],
  tms: { autoRetract: "all" },
  rules: [
    {
      name: "vip-order-detected",
      when: {},
      patterns: [
        { $fact: "Order", $bind: "order", $where: { status: "pending" } },
        { $fact: "Customer", $bind: "customer", $join: { id: "$order.customerId" } },
      ],
      then: [
        { $set: { "result.vipOrder": true } },
        { $set: { "result.customerTier": "$facts.customer.tier" } },
      ],
    },
  ],
});

// Assert facts into working memory
session.assertFact("Order", { status: "pending", amount: 500, customerId: "c1" });
session.assertFact("Customer", { id: "c1", tier: "gold" });

// Fire the engine — rule matches because join constraint is satisfied
const result = session.fire();
// result.rulesFired === 1
// session.getPath("result.vipOrder") === true
// session.getPath("result.customerTier") === "gold"
```

## Concepts

### Fact Types and the Fact Registry

Facts are typed objects stored in working memory. You declare fact types in `SessionConfig.factTypes`:

```typescript
const config: SessionConfig = {
  factTypes: [
    { name: "Order", fields: { status: "string", amount: "number", customerId: "string" } },
    { name: "Customer", fields: { id: "string", name: "string", tier: "string" } },
  ],
};
```

Each `FactTypeDefinition` has:
- `name` — unique type identifier
- `fields` — a record of field names to types (`"string" | "number" | "boolean" | "object" | "array" | "unknown"`)

Facts are asserted and retracted at runtime:

```typescript
const factId = session.assertFact("Order", { status: "pending", amount: 100, customerId: "c1" });
session.retractFact(factId); // removes from working memory
session.getFacts("Order");   // returns all Order facts currently in memory
```

### Fact Patterns

A rule's `patterns` field is an array of `FactPattern` objects. Each pattern specifies what facts to match:

```typescript
interface FactPattern {
  readonly $fact: string;   // fact type name (must exist in factTypes)
  readonly $bind: string;   // binding name for matched fact
  readonly $where?: Record<string, unknown>;  // filter conditions
  readonly $join?: Record<string, string>;    // cross-pattern constraints
}
```

### Tokens

Internally, the beta network builds **tokens** — partial and complete match tuples. A token is complete when all patterns in a rule have a matching fact. Only complete tokens cause rule activation.

### Join Semantics

Join constraints (`$join`) specify field equality across patterns. The syntax references another binding's field:

```typescript
{ $join: { id: "$order.customerId" } }
```

This means: "the `id` field of this fact must equal the `customerId` field of the fact bound to `order`."

Joins are evaluated incrementally — when a new fact is asserted, only relevant partial tokens are extended.

## Pattern Syntax Reference

### `$fact`

The fact type to match. Must correspond to a registered fact type name.

```typescript
{ $fact: "Order", $bind: "o" }
```

### `$bind`

A unique binding name within the rule. Used to reference this fact's data in `$join` constraints and `then` actions.

```typescript
{ $fact: "Order", $bind: "order" }
// Referenced as "$order.fieldName" in $join
// Referenced as "$facts.order.fieldName" in then stages
```

### `$where`

MongoDB-style filter applied to facts of the given type. Only facts matching the filter participate in the join.

```typescript
{ $fact: "Order", $bind: "order", $where: { status: "pending" } }
{ $fact: "Order", $bind: "order", $where: { amount: { $gt: 100 } } }
```

### `$join`

Cross-pattern equality constraints. Keys are field names on the current pattern's fact; values are `$<bindingName>.<fieldName>` references.

```typescript
// Customer.id must equal the order's customerId
{ $fact: "Customer", $bind: "customer", $join: { id: "$order.customerId" } }
```

Multiple join fields are supported (all must match):

```typescript
{ $fact: "Address", $bind: "addr", $join: { customerId: "$customer.id", region: "$order.region" } }
```

## Using Bindings in Actions

When a pattern rule fires, matched fact data is available via `$facts.<bindingName>.<field>` in `then` stages.

### Direct field reference

```typescript
then: [{ $set: { "result.amount": "$facts.order.amount" } }]
```

### Multiple bindings

```typescript
then: [
  { $set: { "result.orderAmount": "$facts.order.amount" } },
  { $set: { "result.customerName": "$facts.customer.name" } },
]
```

### Expression operators

```typescript
then: [
  { $set: { "result.doubled": { $multiply: ["$facts.order.amount", 2] } } },
]
```

Bindings are injected into the action scope only during rule execution and are not persisted in session state.

## TMS Behavior with Facts

When `tms.autoRetract` is configured (typically `"all"`), the Truth Maintenance System tracks which facts contributed to a rule firing. If any contributing fact is retracted, the rule's writes are automatically reverted.

### Single-fact retraction

```typescript
const factId = session.assertFact("Order", { status: "pending", amount: 100, customerId: "c1" });
session.fire();
// session.getPath("$ui.orderActive") === true

session.retractFact(factId);
// session.getPath("$ui.orderActive") === undefined  (auto-reverted)
```

### Multi-fact joins

For join rules, retracting **any** contributing fact triggers retraction:

```typescript
const orderId = session.assertFact("Order", { status: "pending", amount: 50, customerId: "c1" });
const custId = session.assertFact("Customer", { id: "c1", tier: "gold" });
session.fire();
// Rule fired, writes applied

session.retractFact(orderId); // OR session.retractFact(custId)
// Either retraction reverts the rule's writes
```

### Cascade behavior

If rule A writes state that rule B depends on (via scope conditions), retracting a fact that reverts rule A's writes will cause rule B to deactivate on the next `fire()` cycle:

```typescript
// Rule A: patterns → sets "$ui.fromFact" = true
// Rule B: when: { "$ui.fromFact": true } → sets "$ui.cascaded" = true

session.retractFact(factId);
// "$ui.fromFact" is reverted immediately
session.fire();
// "$ui.cascaded" is now also reverted
```

### Integration with scope-based TMS

Fact-based TMS works alongside existing scope-based TMS. Rules without `patterns` continue to use scope-only truth maintenance. The two mechanisms are complementary.

## Examples

### Example 1: Two-Way Join — Order + Customer

Correlate orders with their customers and extract joined data.

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "Order", fields: { status: "string", amount: "number", customerId: "string" } },
    { name: "Customer", fields: { id: "string", name: "string", tier: "string" } },
  ],
  rules: [
    {
      name: "enrich-order",
      when: {},
      patterns: [
        { $fact: "Order", $bind: "order", $where: { status: "pending" } },
        { $fact: "Customer", $bind: "customer", $join: { id: "$order.customerId" } },
      ],
      then: [
        { $set: { "result.orderAmount": "$facts.order.amount" } },
        { $set: { "result.customerName": "$facts.customer.name" } },
        { $set: { "result.customerTier": "$facts.customer.tier" } },
      ],
    },
  ],
});

// Assert order first — rule does NOT fire (no matching customer yet)
session.assertFact("Order", { status: "pending", amount: 250, customerId: "c1" });
let result = session.fire();
console.log(result.rulesFired); // 0

// Assert matching customer — rule fires
session.assertFact("Customer", { id: "c1", name: "Alice", tier: "gold" });
result = session.fire();
console.log(result.rulesFired); // 1
console.log(session.getPath("result.orderAmount"));   // 250
console.log(session.getPath("result.customerName"));  // "Alice"
console.log(session.getPath("result.customerTier"));  // "gold"
```

### Example 2: Three-Way Join — Order + Customer + Address

Chain joins across three fact types.

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "Order", fields: { id: "string", customerId: "string", amount: "number" } },
    { name: "Customer", fields: { id: "string", name: "string" } },
    { name: "Address", fields: { customerId: "string", city: "string", zip: "string" } },
  ],
  rules: [
    {
      name: "full-order-context",
      when: {},
      patterns: [
        { $fact: "Order", $bind: "order" },
        { $fact: "Customer", $bind: "customer", $join: { id: "$order.customerId" } },
        { $fact: "Address", $bind: "address", $join: { customerId: "$customer.id" } },
      ],
      then: [
        { $set: { "result.customerName": "$facts.customer.name" } },
        { $set: { "result.shippingCity": "$facts.address.city" } },
        { $set: { "result.orderAmount": "$facts.order.amount" } },
      ],
    },
  ],
});

// All three facts needed for a complete match
session.assertFact("Order", { id: "ord-1", customerId: "c1", amount: 100 });
session.assertFact("Customer", { id: "c1", name: "Bob" });
console.log(session.fire().rulesFired); // 0 — still missing Address

session.assertFact("Address", { customerId: "c1", city: "Portland", zip: "97201" });
console.log(session.fire().rulesFired); // 1
console.log(session.getPath("result.shippingCity")); // "Portland"
```

### Example 3: TMS Retraction Cascade

Demonstrates automatic write reversal when a contributing fact is removed.

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "Order", fields: { status: "string", amount: "number", customerId: "string" } },
    { name: "Customer", fields: { id: "string", tier: "string" } },
  ],
  tms: { autoRetract: "all" },
  rules: [
    {
      name: "vip-match",
      when: {},
      patterns: [
        { $fact: "Order", $bind: "order" },
        { $fact: "Customer", $bind: "customer", $join: { id: "$order.customerId" } },
      ],
      then: [{ $set: { "$ui.vipMatch": true } }],
    },
    {
      // Scope-based rule that depends on the first rule's output
      name: "show-banner",
      when: { "$ui.vipMatch": true },
      then: [{ $set: { "$ui.showBanner": true } }],
    },
  ],
});

// Build the join
const orderId = session.assertFact("Order", { status: "pending", amount: 500, customerId: "c1" });
session.assertFact("Customer", { id: "c1", tier: "platinum" });
session.fire();

console.log(session.getPath("$ui.vipMatch"));   // true
console.log(session.getPath("$ui.showBanner")); // true

// Retract the order — TMS reverts vip-match writes immediately
session.retractFact(orderId);
console.log(session.getPath("$ui.vipMatch"));   // undefined (reverted)

// Fire again to propagate cascade to scope-based rule
session.fire();
console.log(session.getPath("$ui.showBanner")); // undefined (cascaded retraction)
```

## Migration Guide

### No Breaking Changes

Beta join is purely additive. Existing rules that use only `when` conditions (scope-based evaluation) continue to work exactly as before:

```typescript
// This rule is unchanged and unaffected by the beta join feature
const existingRule: ProductionRule = {
  name: "scope-only-rule",
  when: { "data.x": { $gt: 5 } },
  then: [{ $set: { "result.big": true } }],
};
```

### What's New

| Feature | Before | After |
|---------|--------|-------|
| Fact types | N/A | `SessionConfig.factTypes` |
| Pattern matching | N/A | `ProductionRule.patterns` |
| Fact working memory | N/A | `assertFact()` / `retractFact()` / `getFacts()` |
| Fact bindings in actions | N/A | `$facts.<bind>.<field>` |
| TMS for facts | N/A | Auto-retraction on fact removal |

### Mixed Rules

Rules can combine scope conditions (`when`) with fact patterns (`patterns`). Both must be satisfied for the rule to fire:

```typescript
{
  name: "mixed-rule",
  when: { "config.enabled": true },  // scope condition
  patterns: [{ $fact: "Order", $bind: "order" }],  // fact pattern
  then: [{ $set: { "result.active": true } }],
}
```

The rule fires only when `config.enabled` is `true` in scope **and** at least one Order fact exists in working memory.

### Checklist for Existing Users

- **No action required** — existing rules, `when` conditions, TMS behavior, and `fire()` semantics are unchanged.
- **Optional adoption** — add `factTypes` to your config and `patterns` to rules when you need multi-fact correlation.
- **TMS integration** — if you already use `tms: { autoRetract: "all" }`, fact-based retraction works automatically.
