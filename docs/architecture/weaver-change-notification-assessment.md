# Weaver change notification assessment

**Status:** Proposed / source assessment; not an accepted ADR or delivered integration.
**Date:** 2026-09-30 · **Issue:** armada-48zqt

Companion: [plugin runtime 0.1 proposal](./plugin-runtime-0.1-proposal.md).
The [host boundaries](./plugin-envelope-host-deployment-boundaries.md) remain proposed.
This assessment does not change configuration ownership or authorize implementation.

## Evidence baseline

Ghost runtime baseline is master `146f733`; this documentation tree is HEAD `76ac85e`.
Weaver is the clean local `main` checkout at `39790b06bba74a54db06d91328e5319b234f1f24`.
Upstream references below pin that SHA in `surikaterna/weaver`, not a sibling filesystem path.
These are inspected source versions, not proof of published packages or deployed behavior.
Local Weaver manifests identify [client `0.1.2`][client-version] and [server `0.1.4`][server-version];
the [pending minor changeset][pending] prevents treating HEAD capabilities as release evidence.
No registry lookup, runtime test, deployment inspection, or ongoing freshness guarantee is implied.

## What Weaver actually signals

| Surface | Source observation | Boundary |
| --- | --- | --- |
| Service mutation | [Mutation pipeline][mutations] awaits successful provider write/remove, then updates cache/revision/mounts, emits non-internal delta, and schedules flush | Not a pending-write notification and not an independently established durable-flush acknowledgement |
| Local subscription | [Service `onDelta`][service] adds/removes callbacks | In-process signal, not a transport or file watcher |
| External refresh | `reloadProvider` and `refreshProviders` load state and update revision without emitting delta | A revision change need not produce a change event |
| Poll detector | [Detector][detector] calls refresh; marked unwired in stock startup | Its existence does not establish automatic external-file notifications |
| Stock server | [Server runtime][server] constructs SSE adapter and starts checkpoint timer | SSE is wired, not merely a transport sketch |
| Local config runtime | [State container][state] notifies subscribers after local state operations | Does not itself watch the backend |

Provider success precedes publication, but durability depends on provider and flush semantics.
Internal writes deliberately skip public deltas. Do not promise every authoritative change is pushed.
Schema [service/fragment registration][registration] describes configuration schema ownership/slots;
it is not an executable plugin assignment, deployment binding, or readiness model.

## Effective scope and revision semantics

[State resolution][resolution] merges base providers in supplied order, with later providers winning.
Scope paths are caller-ordered; fixed scoped data is merged before dynamic data for each scope,
and the resulting scoped state overrides base state. These are configuration scopes, not tenant authorization.
Revision combines a state hash and clock value: useful provenance/equality information, not a replay cursor,
sequence number, globally ordered transaction ID, or cross-registry atomic commit.

[Effective reads][effective] distinguish `get`/`getNamespace` from `resolveAll`:
the former use merged scoped state; the latter returns base `entries` and separate `scopes`.
Blindly consuming `snapshot.entries` loses effective overrides even when a scope was requested.
Removing an override requires resolving the exposed lower layer, not assigning the raw removal payload.
Ghost should delegate this resolution to Weaver, not reproduce its merge engine.

## SSE wire behavior and recovery limits

[SSE adapter][sse] emits `change` with key, value, action, revision, layer, environment and timestamp.
It sends an initial `snapshot` and defaults to a checkpoint every 30 seconds.
The snapshot transmits `entries` and revision, omitting the separate scoped snapshot map.
Prefix and scope options filter events; scope filtering compares the delta layer, not effective tenant state.
A base-layer change relevant to a scoped consumer is therefore not an effective-scope subscription guarantee.

`since` is accepted but explicitly ignored: no delta history is retained for replay.
The bounded per-client message buffer is not a durable log or acknowledgement protocol.
Checkpoints carry revision, not missing changes; reconnect does not establish gap-free delivery.
Snapshot acquisition and live callbacks also require a consumer-side race strategy.

## Client API is not an effective-state watcher

The [public client entry][client-api] exports `createWeaverClient`, `createHttpTransport`,
`WeaverTransport` and related APIs. Prefer these boundaries over a reflexive second SSE implementation.
[HTTP methods][http] support scoped gets/snapshots, start SSE for the first subscriber and stop it
after the last unsubscribe. Writes can send `If-Match`; [REST headers][headers] return ETag.
Optimistic write concurrency does not provide event replay or a multi-registry read transaction.

[SSE connection][connection] dispatches only `change` payloads to delta handlers.
It ignores snapshots and records checkpoint receipt time, not checkpoint revision.
Reconnect uses exponential backoff from 1 to 32 seconds, subject to the configured attempt limit.
It sends no scope/prefix/since or `Last-Event-ID` recovery parameter in the inspected connection path.
The parser retains an incomplete line but resets event/data accumulators per processed chunk:
an event split between complete lines across chunks can lose its type/data association.
This is a static reliability concern, not a reproduced production incident.

[Client runtime][client-runtime] boots before subscribing, leaving a read/subscribe race to address.
Unscoped raw deltas mutate cached base state; scoped deltas do not update the scope loader here.
The path does not re-resolve effective state or advance the boot revision on each event.
`onChange` delivery and `pendingRestart` callbacks are notifications, not actual restart/refetch execution.
Thus reconnecting the transport is not equivalent to recovering the authoritative effective plan.

The alternative [SCOMP service feed][scomp-server] ignores subscription input and queues local deltas.
The [SCOMP client transport][scomp-client] stops consumption on errors without reconnect.
These adapter contracts do not establish a stock WebSocket endpoint or stronger replay guarantees.

## Authorization prerequisite

The inspected [request handler][handler] routes `/v1/events` before REST authentication;
SSE handling receives no auth middleware. REST permits tokenless non-write requests,
and absent middleware returns no auth context.
[List/get routes][routes] skip visibility/gating when auth context is absent;
the requested scope is resolution input, not proof that the principal may access that tenant.

This is an authorization gap in the inspected stock paths requiring a protected deployment boundary
or upstream fixes before sensitive/multi-tenant use. It is **not** proof of an exposed deployed vulnerability.
Adding a bearer header alone is insufficient: the event path must actually validate it and authorize scope,
and both reads and streams must enforce tenant/service visibility without leaking values or metadata.
Assign the stock authorization block upstream before deployment; Ghost must verify the protected boundary
and retain per-invocation domain authorization. Network reachability and configuration names are not grants.

## What Ghost currently connects

| Ghost source | Current behavior | Missing integration |
| --- | --- | --- |
| [Shell setup](../../packages/shell/src/config-service-setup.ts#L55-L119) | Map-backed reads and local callbacks; separately creates override-session controller | Controller is not connected to that Map; no remote watcher |
| [Hydration](../../packages/shell/src/hydrate-plugin-registry.ts#L50-L55) and [bootstrap](../../packages/shell/src/app/bootstrap.ts#L67-L80) | Supplies configuration service; snapshot applied before subscription | No atomic read/subscribe boundary |
| [Config sync](../../packages/shell/src/plugin-config-sync-controller.ts#L55-L137) | Watches exactly `ghost.plugins.<namespace>` and `.enabled`; ignores payload and rereads leaf/object/default boolean; deduplicates applied value | Concurrent callback applications are not serialized; not a generic plan reconciler |
| [Registry](../../packages/shell/src/plugin-registry.ts#L214-L240) | Enable returns to registered; disable invokes lifecycle cleanup | Enabled is not active; [startup activation](../../packages/shell/src/app/bootstrap.ts#L142-L146) is separate |
| [Backend routes](../../apps/backend/src/config-endpoints.ts#L42-L77) | HTTP configuration endpoints | No notification transport supplied here |
| [PUT](../../apps/backend/src/config-endpoints.ts#L156-L187) / [DELETE](../../apps/backend/src/config-endpoints.ts#L209-L229) | Fresh filesystem providers, write/remove, audit, response | No shared service mutation/notifier path |

[Provider construction](../../apps/backend/src/config-loader.ts#L28-L60) creates providers per call.
[Backend bootstrap](../../apps/backend/src/config-bootstrap.ts#L54-L65) returns a real Weaver service,
but [application startup](../../apps/backend/src/index.ts#L72-L92) discards that return value.
[Route assembly](../../apps/backend/src/index.ts#L102-L114) includes no event route;
[Bun HTTP fetch](../../apps/backend/src/index.ts#L135-L159) adds no WebSocket integration.
[`config-stubs`](../../apps/backend/src/config-stubs.ts#L1-L33) re-exports real implementations despite its name.
Current Ghost integration must not be conflated with capabilities found in newer Weaver source.

## Recommended bridge, pending approval

Weaver remains the assignment/configuration authority; add no second configuration engine or persistence.
A direct library or thin facade resolves authorized service + tenant effective configuration and combines it
with pinned artifact-registry metadata into a validated desired plan, separate from an MF manifest.
Use effective reads rather than raw deltas or snapshot base entries as the authoritative input.

For 0.1, recommend **authoritative polling with push as a latency optimization** until reliability is proven.
Polling must read refreshed authoritative state: repeatedly reading a stale server/provider cache is not recovery.
Treat hints as invalidations: coalesce and serialize rereads per scoped instance, discard superseded results,
and never let an older async completion overwrite a newer accepted generation.
Subscribe before reading where supported, mark dirty during reads and reread after a race;
otherwise perform a follow-up authoritative read and retain polling as the safety net.
Request recovery on reconnect when exposed; the inspected SDK does not expose a sufficient recovery signal.
Do not infer one from `onChange` or its checkpoint timestamp. Prefer upstream repair over duplicating SSE.

If Weaver's existing model supports one validated effective plan document, prefer it to unrelated key reads
to reduce multi-key races. This does not create atomicity with artifact registries or policy services.
Record configuration revision, artifact identity and authorization provenance separately.
Freshness must be bounded and configurable; no seconds are selected by this assessment.
Expired authorization fails closed; last-good state may be used only while its explicit validity still holds.
Revocation cannot be hidden behind a perpetual cache. Recheck authorization per invocation.
Shutdown must stop polling/subscriptions, cancel pending rereads and prevent post-disposal application.

## Ownership and evidence gates

Weaver owners: stock read/stream authorization, effective-state recovery, chunk-safe parsing,
refresh notification semantics and release evidence for the selected public API.
Ghost owners: protected transport integration, effective-plan adapter, serialized reconciliation,
freshness/expiry policy, lifecycle and packaging. Existing follow-ups remain armada-i1oqr,
armada-rwngs and armada-gx8fv; this document is not a replacement task tracker.

[Shell sync tests](../../apps/shell/test/plugin-config-sync-controller.test.mjs#L72-L188) mock local callbacks;
[backend endpoint tests](../../apps/backend/test/config-endpoints.test-hooked.mjs#L118-L155) exercise filesystem effects,
not cross-process notification delivery. Empty skipped configuration tests are not integration evidence.
Future acceptance must cover scoped override removal, dropped/duplicate/reordered hints, split chunks,
reconnect and read/subscribe races, authorization expiry, tenant isolation and shutdown.
These are proposed gates, not tests executed in this documentation task.

## Pinned Weaver source references

[mutations]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/core/config-service-mutations.ts#L65-L229
[service]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/core/config-service.ts#L309-L357
[detector]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/core/change-detector.ts#L15-L35
[server]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/server.ts#L139-L173
[state]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/config-runtime/src/state-container.ts#L53-L138
[registration]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/config-types/src/schema-registration.ts#L20-L69
[resolution]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/core/config-service-state.ts#L19-L108
[effective]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/core/config-service.ts#L234-L294
[sse]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/transport/sse-adapter.ts#L58-L164
[client-api]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-client/src/index.ts#L1-L67
[http]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-client/src/http-transport-legacy.ts#L43-L175
[headers]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/transport/rest-helpers.ts#L91-L100
[connection]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-client/src/sse-connection.ts#L49-L161
[client-runtime]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-client/src/client-runtime.ts#L44-L162
[scomp-server]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/transport/scomp-service.ts#L352-L383
[scomp-client]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/transport-scomp/src/transport.ts#L171-L205
[handler]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/server-request-handler.ts#L39-L228
[routes]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/src/transport/rest-routes.ts#L82-L327
[pending]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/.changeset/registered-transports-connect.md#L1-L7
[client-version]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-client/package.json#L1-L9
[server-version]: https://github.com/surikaterna/weaver/blob/39790b06bba74a54db06d91328e5319b234f1f24/packages/weaver-server/package.json#L1-L9
