# Temporal Planning Guide

Time-aware rules allow the arbiter to reason about durations, deadlines, schedules, and windowed aggregations. This guide covers clock setup, temporal operators, scheduled activations, rule expiry, and time-windowed aggregation.

## Clock Setup

### Production: Real Clock

```typescript
import { createRealClock, createSession } from "@arbitre/core";

const session = createSession({
  clock: createRealClock(),
  rules: [/* ... */],
});
```

### Testing: Virtual Clock

```typescript
import { createVirtualClock, createSession } from "@arbitre/core";

const clock = createVirtualClock(1000); // start at t=1000ms
const session = createSession({ clock, rules: [/* ... */] });

clock.advance(5000); // deterministically move forward 5s
session.tick();      // evaluate rules at new time
```

### `$meta.$now` — Auto-Injected Time

When a clock is configured, the session automatically injects the current time into scope as `$meta.$now`. Temporal operators read this value to evaluate conditions.

## The `tick()` Method

`tick()` advances the session's temporal state and triggers a fire cycle:

1. Sets time (if virtual clock and explicit `now` argument provided)
2. Checks and expires rules that exceeded their duration
3. Evicts stale entries from windowed accumulate nodes
4. Fires due scheduled timers
5. Runs the normal rule-firing cycle

```typescript
// With virtual clock — pass explicit time
const result = session.tick(6000); // set clock to 6000ms and fire

// Or advance the clock externally, then tick
clock.advance(1000);
const result = session.tick();
```

## Temporal Expression Operators

All temporal operators read `$meta.$now` from scope. They return `false` gracefully when required values are `undefined`.

### `$elapsed` — Time Since Event Exceeds Threshold

True when `now - timestamp > threshold`.

```typescript
// Condition: user inactive for more than 30 seconds
{
  conditions: {
    "$elapsed": ["$state.lastActivity", 30000]
  }
}
```

### `$within` — Time Since Event Is Within Window

True when `now - timestamp < window`.

```typescript
// Condition: login happened within last 5 minutes
{
  conditions: {
    "$within": ["$state.lastLogin", 300000]
  }
}
```

### `$after` — Current Time Past a Point

True when `now > timestamp`.

```typescript
// Condition: past the offer deadline
{
  conditions: {
    "$after": ["$state.offerDeadline"]
  }
}
```

### `$before` — Current Time Before a Point

True when `now < timestamp`.

```typescript
// Condition: before the offer deadline
{
  conditions: {
    "$before": ["$state.offerDeadline"]
  }
}
```

### Graceful Handling of Undefined Values

All operators return `false` when:
- `$meta.$now` is not set (no clock configured)
- The referenced timestamp path resolves to a non-number
- Arguments are missing or of the wrong type

This prevents runtime errors and allows rules to silently skip evaluation until time data is available.

## Scheduled Rule Activations

Schedule rules to fire after a delay, or on a repeating interval.

### `session.scheduleRule(name, options)`

```typescript
// One-shot: fire "checkExpiry" after 5 minutes
session.scheduleRule("checkExpiry", { delay: 300000 });

// Repeating: fire "heartbeat" every 10 seconds
session.scheduleRule("heartbeat", { delay: 10000, repeat: true });
```

### `session.cancelSchedule(name)`

```typescript
session.cancelSchedule("heartbeat"); // stop repeating timer
```

### How Timers Fire

Timers don't fire autonomously — they fire when `tick()` is called and the current time exceeds the timer's `fireAt`. On each tick:

- One-shot timers are removed after firing
- Repeating timers reschedule at `fireAt + interval`

## Rule Expiry

Rules can auto-deactivate after a duration using the `expires` option.

```typescript
const rules = [
  {
    name: "promoOffer",
    conditions: { "$state.eligible": true },
    writes: { "$state.showBanner": true },
    expires: 300000, // auto-deactivate after 5 minutes
  },
];
```

When a rule expires on `tick()`:
1. Its writes are reverted (TMS retraction)
2. Its condition state is cleared
3. Its expiry tracker is reset

If the rule's conditions become true again later, it re-activates with a fresh expiry timer.

## Time-Windowed Aggregation

Add `window` (in ms) to an accumulate config to only consider facts asserted within the time window.

```typescript
const session = createSession({
  clock: createVirtualClock(0),
  rules: [/* ... */],
  accumulateConfigs: [
    {
      name: "recentEvents",
      factType: "event",
      fn: "$count",
      window: 60000, // only count events from last 60 seconds
    },
  ],
});
```

On each `tick()`, facts older than `now - window` are automatically evicted. The aggregate value updates accordingly.

Use cases:
- **Rate limiting**: count actions in a sliding window
- **Recent activity**: aggregate scores/values over recent time
- **Trend detection**: compare windowed values against thresholds

## Examples

### Example 1: Idle Detection

Detect when a user has been inactive for 30 seconds and show an engagement prompt.

```typescript
import { createVirtualClock, createSession } from "@arbitre/core";

const clock = createVirtualClock(0);
const session = createSession({
  clock,
  initialState: { lastActivity: 0, showIdlePrompt: false },
  rules: [
    {
      name: "idleDetection",
      conditions: {
        "$elapsed": ["$state.lastActivity", 30000],
      },
      writes: { "$state.showIdlePrompt": true },
    },
  ],
});

// User is active at t=0
session.assert("$state.lastActivity", 0);
session.tick(0);
// showIdlePrompt is false — not enough time passed

// Advance 31 seconds — user is idle
const result = session.tick(31000);
// showIdlePrompt is now true

// User becomes active again
session.assert("$state.lastActivity", 31000);
session.tick(31000);
// $elapsed is no longer true → writes retracted, showIdlePrompt = false
```

### Example 2: Offer Expiry

A promotional offer activates when the user is eligible, but auto-expires after 5 minutes.

```typescript
import { createVirtualClock, createSession } from "@arbitre/core";

const clock = createVirtualClock(0);
const session = createSession({
  clock,
  initialState: { eligible: false, showOffer: false },
  rules: [
    {
      name: "promoOffer",
      conditions: { "$state.eligible": true },
      writes: { "$state.showOffer": true },
      expires: 300000, // 5 minutes
    },
  ],
});

// User becomes eligible
session.assert("$state.eligible", true);
session.tick(1000);
// showOffer = true, offer activated at t=1000

// 4 minutes later — still active
session.tick(241000);
// showOffer = true

// 5 minutes after activation — expired
session.tick(301000);
// showOffer = false (writes reverted by expiry)
```

### Example 3: Rate Limiting with Windowed Aggregation

Block actions when more than 10 events occur in a 60-second window.

```typescript
import { createVirtualClock, createSession } from "@arbitre/core";

const clock = createVirtualClock(0);
const session = createSession({
  clock,
  initialState: { rateLimited: false },
  factTypes: ["apiCall"],
  accumulateConfigs: [
    {
      name: "recentCalls",
      factType: "apiCall",
      fn: "$count",
      window: 60000,
    },
  ],
  rules: [
    {
      name: "rateLimiter",
      conditions: {
        "$agg.recentCalls": { "$gt": 10 },
      },
      writes: { "$state.rateLimited": true },
    },
  ],
});

// Simulate 11 API calls at t=1000
for (let i = 0; i < 11; i++) {
  session.assertFact({ type: "apiCall", data: { endpoint: "/api" } });
}
session.tick(1000);
// rateLimited = true (11 calls in window)

// Advance past the window — old calls evicted
session.tick(62000);
// rateLimited = false (0 calls in current window)
```

## Testing with Virtual Clock

### Pattern: Deterministic Time Control

```typescript
import { createVirtualClock, createSession } from "@arbitre/core";

const clock = createVirtualClock(0);
const session = createSession({ clock, rules: [/* ... */] });

// Advance time precisely — no flaky setTimeout-based tests
clock.advance(5000);
session.tick();
expect(session.getState().someValue).toBe(true);
```

### Testing Scheduled Rules

```typescript
const clock = createVirtualClock(0);
const session = createSession({
  clock,
  rules: [
    {
      name: "reminder",
      conditions: { "$state.active": true },
      writes: { "$state.reminded": true },
    },
  ],
  initialState: { active: true, reminded: false },
});

// Schedule reminder to fire after 10s
session.scheduleRule("reminder", { delay: 10000 });

// Not yet due
session.tick(5000);
expect(session.getState().reminded).toBe(false);

// Now due
session.tick(10000);
expect(session.getState().reminded).toBe(true);
```

### Testing Expiry Behavior

```typescript
const clock = createVirtualClock(0);
const session = createSession({
  clock,
  initialState: { value: false },
  rules: [
    {
      name: "temporary",
      conditions: { "$state.trigger": true },
      writes: { "$state.value": true },
      expires: 5000,
    },
  ],
});

session.assert("$state.trigger", true);
session.tick(100); // activates at t=100

expect(session.getState().value).toBe(true);

// Expire after 5s from activation
session.tick(5100);
expect(session.getState().value).toBe(false); // writes reverted
```

### Testing Windowed Aggregation Eviction

```typescript
const clock = createVirtualClock(0);
const session = createSession({
  clock,
  factTypes: ["event"],
  accumulateConfigs: [
    { name: "count", factType: "event", fn: "$count", window: 10000 },
  ],
  rules: [/* use $agg.count in conditions */],
});

session.assertFact({ type: "event", data: {} });
session.tick(1000);
// count = 1

session.tick(12000);
// count = 0 (fact evicted — older than 10s window)
```

### Key Testing Principles

1. **Always use `createVirtualClock()`** — never rely on real time in tests
2. **Advance time explicitly** — use `clock.advance(ms)` or pass time to `tick(now)`
3. **Time only moves forward** — `clock.setTime()` throws if you try to go backward
4. **Tick triggers everything** — expiry, eviction, timers, and rule evaluation all happen in `tick()`
