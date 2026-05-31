# Accumulate Patterns Guide

Accumulate nodes maintain **running aggregates** over asserted facts in a session. They enable aggregate reasoning — firing rules based on counts, sums, averages, or custom computations across fact populations.

**Use cases:** threshold alerting, inventory tracking, rate limiting, statistical analysis, cross-entity aggregation.

---

## Quick Start

Count all orders in a session and expose the result at `$aggregates.orderCount`:

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "order", fields: { amount: "number", status: "string" } },
  ],
  accumulates: [
    { factType: "order", fn: "$count", field: "", alias: "orderCount" },
  ],
});

session.assertFact("order", { amount: 50, status: "open" });
session.assertFact("order", { amount: 120, status: "open" });

const state = session.getState();
console.log(state.$aggregates.orderCount); // 2
```

---

## AccumulateConfig Reference

```typescript
interface AccumulateConfig {
  readonly factType: string;    // Which fact type to aggregate
  readonly fn: string;          // Aggregate function name ($count, $sum, etc.)
  readonly field: string;       // Field to extract (empty string for $count)
  readonly alias: string;       // Result path: $aggregates.<alias>
  readonly filter?: Record<string, unknown>; // Optional filter before aggregation
  readonly binding?: string;    // For cross-type: binding name from pattern rule
  readonly rule?: string;       // For cross-type: rule name providing beta tokens
  readonly window?: number;     // Time window in ms (requires clock)
}
```

### Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `factType` | Yes | The fact type to aggregate over |
| `fn` | Yes | Aggregate function (`$count`, `$sum`, `$avg`, `$min`, `$max`, `$collect`) |
| `field` | Yes | Field to extract from fact data (use `""` for `$count`) |
| `alias` | Yes | Key under `$aggregates` where the result is stored |
| `filter` | No | Object of key-value pairs — only facts matching all pairs are included |
| `binding` | No | Cross-type: binding name from a pattern rule's beta network |
| `rule` | No | Cross-type: the rule whose beta tokens scope accumulation |
| `window` | No | Time window in ms — only facts within the window contribute |

---

## Built-in Functions

### `$count`

Counts matching facts. The `field` value is ignored (use `""`).

```typescript
{ factType: "order", fn: "$count", field: "", alias: "orderCount" }
```

Returns: `number` (0 when no facts match)

### `$sum`

Sums a numeric field across matching facts.

```typescript
{ factType: "order", fn: "$sum", field: "amount", alias: "totalAmount" }
```

Returns: `number` (0 when no facts match)

### `$avg`

Averages a numeric field across matching facts.

```typescript
{ factType: "order", fn: "$avg", field: "amount", alias: "avgAmount" }
```

Returns: `number | null` (null when no facts match)

### `$min`

Finds the minimum value of a numeric field.

```typescript
{ factType: "order", fn: "$min", field: "amount", alias: "minAmount" }
```

Returns: `number | null` (null when no facts match)

### `$max`

Finds the maximum value of a numeric field.

```typescript
{ factType: "order", fn: "$max", field: "amount", alias: "maxAmount" }
```

Returns: `number | null` (null when no facts match)

### `$collect`

Collects the full `data` object of each matching fact into an array.

```typescript
{ factType: "order", fn: "$collect", field: "", alias: "allOrders" }
```

Returns: `Record<string, unknown>[]` (empty array when no facts match)

---

## Session-Level vs Rule-Level Configuration

### Session-Level

Define accumulates in `createSession()` for session-wide aggregates:

```typescript
const session = createSession({
  accumulates: [
    { factType: "order", fn: "$count", field: "", alias: "orderCount" },
    { factType: "order", fn: "$sum", field: "amount", alias: "totalRevenue" },
  ],
});
```

### Rule-Level (Inline)

Define accumulates on a rule via `rule.accumulate`. They are auto-registered when the rule is registered:

```typescript
const alertRule = {
  name: "high-order-volume",
  when: { "$aggregates.orderCount": { $gte: 100 } },
  then: [{ $set: { alertLevel: "high" } }],
  accumulate: [
    { factType: "order", fn: "$count", field: "", alias: "orderCount" },
  ],
};
```

Both approaches produce the same runtime behavior — the accumulate nodes update `$aggregates` on every fact assertion/retraction.

---

## Reactive Re-evaluation

Accumulate values are part of session state at `$aggregates.*`. When an aggregate changes, rules whose `when` clause references `$aggregates` are re-evaluated automatically.

### Threshold Crossing

When an aggregate crosses a threshold, the rule fires:

```typescript
// Rule fires when orderCount reaches 100
when: { "$aggregates.orderCount": { $gte: 100 } }
```

### TMS Retraction

If `tms.autoRetract` is configured and the aggregate drops below the threshold (e.g., facts are retracted), the rule's contributions are automatically retracted — the system maintains truth.

### `autoFireOnFactChange`

Set `autoFireOnFactChange: true` in session config to trigger rule evaluation immediately on every fact assertion/retraction (rather than requiring an explicit `fire()` call):

```typescript
const session = createSession({
  autoFireOnFactChange: true,
  accumulates: [{ factType: "order", fn: "$count", field: "", alias: "orderCount" }],
  rules: [alertRule],
});
// Asserting a fact immediately triggers rule evaluation
session.assertFact("order", { amount: 50, status: "open" });
```

---

## Custom Functions

Register custom aggregate functions via `SessionConfig.accumulateFunctions`:

```typescript
import type { CustomAccumulateFunction } from "@ghost-shell/arbiter";

const medianFn: CustomAccumulateFunction = {
  fn: (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  },
};

const session = createSession({
  accumulateFunctions: { $median: medianFn },
  accumulates: [
    { factType: "order", fn: "$median", field: "amount", alias: "medianOrder" },
  ],
});
```

The `CustomAccumulateFunction` interface requires a single `fn` property of type `(values: readonly number[]) => number | null`.

---

## Cross-Type Accumulation

> See also: [Beta Join Patterns](./beta-join.md)

Cross-type accumulation aggregates over **beta join tokens** — only facts that participate in a complete pattern match contribute to the aggregate. This enables scoped aggregation like "sum of orders for VIP customers."

### Configuration

Use the `binding` and `rule` fields:

```typescript
{
  factType: "order",
  fn: "$sum",
  field: "amount",
  alias: "vipSpend",
  binding: "order",   // The binding name in the pattern rule
  rule: "vip-orders", // The rule whose beta tokens scope this
}
```

### How It Works

1. A pattern rule (e.g., `vip-orders`) joins `customer` and `order` facts via beta network.
2. When a complete token is created (both customer and order matched), the cross-type accumulator extracts the specified field from the bound fact.
3. When a token is removed (fact retracted or join broken), the contribution is removed.

The aggregate only includes values from facts that are part of **complete joins** — not all facts of that type.

---

## Time-Windowed Aggregation

> See also: [Temporal Patterns](./temporal.md)

Windowed accumulation restricts aggregation to facts asserted within a sliding time window. Requires a `clock` in the session config.

### Configuration

```typescript
{
  factType: "request",
  fn: "$count",
  field: "",
  alias: "recentRequests",
  window: 60_000, // 60 seconds
}
```

### Eviction

On each clock tick, facts older than `now - window` are evicted from the aggregate. This enables rate-limiting and time-bounded statistics.

---

## Examples

### Example 1: Threshold Alerting

Fire a rule when order count exceeds a threshold:

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "order", fields: { amount: "number", customerId: "string" } },
  ],
  accumulates: [
    { factType: "order", fn: "$count", field: "", alias: "orderCount" },
  ],
  rules: [
    {
      name: "high-volume-alert",
      when: { "$aggregates.orderCount": { $gt: 100 } },
      then: [{ $set: { alertLevel: "high", reason: "Order volume exceeded threshold" } }],
    },
  ],
  autoFireOnFactChange: true,
});

// Assert 101 orders...
for (let i = 0; i < 101; i++) {
  session.assertFact("order", { amount: 10 + i, customerId: `c-${i}` });
}

const state = session.getState();
console.log(state.alertLevel); // "high"
console.log(state.$aggregates.orderCount); // 101
```

### Example 2: Inventory Management

Track stock levels using sum with filters:

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "stock_movement", fields: { sku: "string", quantity: "number", type: "string" } },
  ],
  accumulates: [
    {
      factType: "stock_movement",
      fn: "$sum",
      field: "quantity",
      alias: "warehouseStock",
      filter: { type: "inbound" },
    },
    {
      factType: "stock_movement",
      fn: "$sum",
      field: "quantity",
      alias: "dispatched",
      filter: { type: "outbound" },
    },
  ],
  rules: [
    {
      name: "low-stock-warning",
      when: { "$aggregates.warehouseStock": { $lt: 50 } },
      then: [{ $set: { stockAlert: "low", reorderNeeded: true } }],
    },
  ],
});

session.assertFact("stock_movement", { sku: "WIDGET-A", quantity: 100, type: "inbound" });
session.assertFact("stock_movement", { sku: "WIDGET-A", quantity: 30, type: "outbound" });

session.fire();
const state = session.getState();
console.log(state.$aggregates.warehouseStock); // 100 (only inbound)
console.log(state.$aggregates.dispatched);     // 30 (only outbound)
```

### Example 3: Cross-Type VIP Customer Spend

Sum order amounts only for VIP customers using cross-type accumulation with beta joins:

```typescript
import { createSession } from "@ghost-shell/arbiter";

const session = createSession({
  factTypes: [
    { name: "customer", fields: { id: "string", tier: "string" } },
    { name: "order", fields: { customerId: "string", amount: "number" } },
  ],
  rules: [
    {
      name: "vip-orders",
      patterns: [
        { factType: "customer", binding: "customer", constraints: { tier: "vip" } },
        { factType: "order", binding: "order", constraints: { customerId: { $expr: "customer.id" } } },
      ],
      when: { "$aggregates.vipSpend": { $gt: 1000 } },
      then: [{ $set: { vipHighSpender: true } }],
    },
  ],
  accumulates: [
    {
      factType: "order",
      fn: "$sum",
      field: "amount",
      alias: "vipSpend",
      binding: "order",
      rule: "vip-orders",
    },
  ],
});

// Only orders joined to VIP customers contribute
session.assertFact("customer", { id: "c1", tier: "vip" });
session.assertFact("order", { customerId: "c1", amount: 500 });
session.assertFact("order", { customerId: "c1", amount: 600 });

// Non-VIP orders do NOT contribute to vipSpend
session.assertFact("customer", { id: "c2", tier: "standard" });
session.assertFact("order", { customerId: "c2", amount: 9999 });

session.fire();
const state = session.getState();
console.log(state.$aggregates.vipSpend); // 1100 (only VIP customer orders)
console.log(state.vipHighSpender);       // true
```

> **Note:** Cross-type accumulation requires pattern rules with beta joins. See the [Beta Join Patterns guide](./beta-join.md) for details on configuring `patterns` with bindings and constraints.
