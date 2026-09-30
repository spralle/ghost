# Plugin runtime future directions

**Status:** Proposed discussion / pending review — unscheduled, not accepted or shipped.
**Date:** 2026-09-30 · **Issue:** armada-7qumi.
**Context:** armada-48zqt, armada-fpclw, armada-jt1uv / PR170; unmerged base `76ac85e`.

Companions: [0.1 PRD](./plugin-runtime-0.1-prd.md),
[Architectural Review Brief](./plugin-runtime-0.1-arb.md) and
[historical proposal](./plugin-runtime-0.1-proposal.md).
These topics preserve discussion, not a roadmap, promised version or task checklist.
Beads owns status/dependencies; inclusion here neither schedules nor authorizes implementation.
Mandatory 0.1 admission security, clean packaging and real three-host proof are not deferred here.

## Production Weaver source integration

Rationale: deployments already using Weaver should retain its configuration authority rather
than duplicate precedence in Ghost. A separately installable source adapter may resolve authorized
effective plans through published APIs; existing config-plugin-runtime retains schema responsibilities.

Prerequisites: resolve published API/version evidence, protected read/stream authorization,
effective `get` semantics, authoritative refresh and recovery across reconnect/read-subscribe races.
Do not treat base snapshot entries or raw deltas as effective scoped state, and do not infer replay
from checkpoint timestamps. The [Weaver assessment](./weaver-change-notification-assessment.md)
pins `39790b06bba74a54db06d91328e5319b234f1f24` and preserves the exact source limitations.
Related follow-ups include armada-ivqvp, armada-bq50h and armada-gx8fv; their Beads records,
not this discussion, determine implementation scope and status.

SCOMP remains an alternative feed to assess, not an established recovery guarantee or a claim
of an existing WebSocket endpoint. It needs its own transport/auth/reconnect evidence.
An optional registry facade could combine source reads and artifact bindings for convenience;
it remains a source adapter, not a new configuration authority or a cross-registry transaction.

## Additional scopes and configuration composition

Rationale: organizations may need organization/workspace/user/environment/region selection
in addition to tenants. Prerequisites are authorized scope resolution and explicit precedence
delegated to Weaver where chosen, plus provenance and tests for override removal.
Configuration scope does not determine process/activation lifetime or request identity.
Configuration templating needs separately defined evaluation, safety and schema rules;
do not extrapolate it from current effective-value composition or invent a second merge engine.

## Loader evolution and provider rollout

Rationale: Module Federation may not be the best loader for every target.
Compare future MF releases or a simpler/custom module loader against measured requirements.
No benchmark, compatibility result or performance advantage is known from this proposal.
Prerequisites include the same admission, real HTTP loading, lifecycle and clean package gates.

Providers may eventually roll out independently of hosts, coexist at multiple versions, drain
old traffic and support rollback. Prerequisites include explicit compatibility negotiation,
versioned cache/instance ownership, routing, resource disposal and side-effect semantics.
Rolling back code cannot undo arbitrary external side effects. A module cache is not a hot-unload
API; worker recycle may be necessary. This does not weaken 0.1's explicit single-version conflict.

## Stronger execution isolation

Rationale: dedicated workers or containers may be needed for untrusted publishers or tenant code.
Prerequisites include a threat model, sandbox boundary, credential mediation, resource quotas,
timeout enforcement and noisy-neighbor controls. Tenant instance namespaces alone provide none
of those guarantees. Dedicated process isolation also changes transport and provider lifetimes.
Do not admit untrusted code under the trusted in-process 0.1 claim while awaiting this work.

## Rich terminal and web presentation

Rationale: full TUI and Formbar/Ink adapters could share semantic contributions while retaining
host-specific rendering. Ink/Formbar TUI support remains provisional, not an available contract.
Prerequisites include terminal root/input/focus/resize ownership, disposal, accessibility and
runtime feasibility. Plain CLI validation in 0.1 does not prove a rich terminal renderer.
Rich web-only components need an authorized semantic fallback where meaningful; otherwise
report unsupported presentation without pretending every host can render the same component.

Search criteria and result tables could support pluggable columns, visibility/order preferences,
filtering and sorting. Prerequisites include typed query semantics and renderer separation.
Server projection authorization remains authoritative; preferences cannot reveal forbidden fields.
Filtering/sorting applies to the full authorized dataset before pagination, not just loaded rows.
See the preserved [multi-target assessment](./multi-target-architecture-assessment.md)
and [host boundaries](./plugin-envelope-host-deployment-boundaries.md) for earlier reasoning.

## Optional telemetry and distributed runtime inventory

Rationale: operators may need a distributed counterpart to local process snapshots, alongside
traces, metrics and logs. An optional OTEL adapter can export telemetry; it must not become
a neutral-core or standalone-demo requirement. Human slf/debug logs are not this state protocol.

A distributed process registry would project local snapshots with boot identity, monotonically
scoped sequences and finite leases. Distinguish expired/unknown from confirmed stopped.
Keep current observed state separate from historical events; telemetry history is not authoritative
routing/readiness. Prerequisites include authenticated reports, ordering, cardinality and retention
policy, liveness semantics and authoritative handler checks even if a projection says ready.

Grafana, Tempo, Loki and Prometheus/Mimir are optional deployment possibilities, not selections.
Redis or Mongo could be evaluated for a current-state projection; neither is selected and both
are not required. TTL must be enforced on reads, not just asynchronous deletion; stale records
must never authorize routing. Decide storage only after consistency/query/operational needs.
Audit and billing require separately designed durable records, not lossy debug logs or expiring leases.
Approved opaque tenant correlation and bounded metric cardinality need explicit policy before export.

## Noncommitment boundary

Future production transport, isolation, rollout and presentation work depends on measured needs
and separate approvals. No date, next version, vendor, storage engine or package count is promised.
The PRD's 0.1 gates still require baseline security, all-host slf integration proof, bounded freshness,
real remote artifacts, honest lifecycle state, independent consumers and existing-web compatibility.
The unresolved runtime, trust and freshness decisions must be settled before those release claims.
