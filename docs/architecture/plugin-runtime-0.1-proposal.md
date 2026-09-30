# Plugin runtime 0.1 proposal

> **HISTORICAL — SUPERSEDED scope proposal (armada-7qumi, 2026-09-30).**
> The [0.1 PRD](./plugin-runtime-0.1-prd.md) and
> [Architectural Review Brief](./plugin-runtime-0.1-arb.md) replace this document's
> recommendations; both are proposed/pending review, not accepted or shipped.
> All old scope, package, milestone and acceptance tables below are **NON-NORMATIVE historical material**.
> The new scope requires a standalone demo with no mandatory Weaver installation,
> independently installable npm source/loader adapters (not internal-only adapters),
> and three real hosts: web server, browser and plain CLI (not server-only proof).
> Earlier source evidence is retained verbatim below; it is not current implementation evidence.
> Deferred topics are retained in [future directions](./plugin-runtime-future-directions.md).

**Status:** Proposed — approval requested; not an accepted ADR or delivered runtime 0.1.
**Date:** 2026-09-30 · **Issue:** armada-48zqt

Builds on the [host boundaries](./plugin-envelope-host-deployment-boundaries.md),
[inventory](./plugin-contract-and-plugin-inventory.md), and
[Weaver notification assessment](./weaver-change-notification-assessment.md).
The latter pins upstream evidence and explains why push is not authoritative effective-state recovery.
Ghost source baseline is master `146f733`, documentation tree HEAD `76ac85e`.
Weaver source baseline is clean main `39790b06bba74a54db06d91328e5319b234f1f24`.
Source observations do not verify published/deployed versions or promise continued freshness.

## Smallest useful candidate

0.1 is a proposed reusable capability milestone, not permission to renumber every package.
It should run an authorized, trusted remote server extension with real lifecycle and effective configuration,
while preserving existing web consumers. A fake-only loader is not a useful delivered runtime.
All executable entries remain optional, including server; zero-entry declarations are valid after admission.
Data-only admission must not execute JavaScript or claim that an external provider is ready.

| Candidate inclusion | Required boundary |
| --- | --- |
| Portable validation | Identity, typed declarations, host compatibility and explicit required/optional dependencies |
| Trusted loading | Allowlisted code/artifact origins; pinned identity; validated host contract; real remote adapter |
| Scoped instances | Explicit service/tenant instance identity, separate mutable activation/configuration state |
| Typed capabilities | Typed provider registration and observed readiness, not metadata-equals-ready |
| Lifecycle | Startup, enable/disable, dependency-local failure, partial-init cleanup, complete shutdown |
| Effective plan | Weaver-authoritative scoped assignments/config, authorized artifact binding and validation |
| Change handling | Poll/reread/reconcile; hints optimize latency; explicit restart-required outcomes where unsafe |
| Diagnostics | Distinguish absent, disabled, denied, unsupported, blocked, failed and ready |

Select one initial runtime and exact release for proof. Node is an initial server-loader candidate,
but Ghost requires Bun: choosing Node needs an explicit approved deviation, not a silent override.
Prefer proving Bun first; package tooling remains Bun. Neither runtime's compatibility is established here.
Module Federation is the first remote-loader candidate, compared with a verified module-loading alternative.
Use a static/fake adapter for deterministic tests, but require at least one real remote candidate before release.

## Explicit exclusions and trust limit

Defer TUI rendering, universal UI contracts, untrusted-code execution and sandbox claims.
Also defer zero-downtime hot rolling, general simultaneous-version coexistence guarantees,
distributed activation transactions, automatic RPC and a second action/configuration engine.
Keep existing actions/intents and their action-path mutation requirements.
Existing browser federation is optional web integration, not a dependency of the neutral/server runtime.

Tenant instance namespacing is not a security sandbox: trusted code in one process can share process resources.
Configuration scope controls effective values, not activation lifetime or request identity.
Registration can live for the scoped extension instance; credentials, principal, transaction and cancellation
belong to each invocation, never captured as a global tenant activation credential.
Authorization remains at the authoritative action/query handler even after successful admission.

## Resolution and reconciliation boundary

Weaver owns assignments and effective scoped configuration; it is not replaced by a Ghost persistence layer.
A direct resolver library or thin facade combines authorized service + tenant context, effective configuration
and pinned artifact-registry metadata into a desired plan. A new network service is not required.
That plan is distinct from the MF asset manifest and from observed active/ready state.
Weaver schema service/fragment registration is not already an executable assignment schema.

Use effective `get`/namespace semantics, not base-only snapshot entries or raw event values.
One validated effective plan document is preferable if the existing Weaver model supports it,
reducing multi-key read races without promising atomicity across configuration, authorization and artifacts.
Validate correspondence, host compatibility and operator allowlists before executing a selected artifact.
Keep revision/artifact/policy provenance separate; a hash-plus-clock revision is not event ordering.

Recommend authoritative polling for 0.1, with optional push invalidation to reduce latency.
Ensure authoritative provider refresh; polling an unchanged cache is not sufficient.
Coalesce and serialize rereads per instance; guard against superseded async completions.
Address subscribe/read races with a dirty generation and follow-up read; recover after reconnect if exposed.
The current SDK does not provide reliable effective recovery merely by subscribing; prefer upstream fixes
over a duplicate SSE client. The [assessment](./weaver-change-notification-assessment.md#recommended-bridge-pending-approval)
sets the transport/freshness constraints.

Apply only validated plans with still-valid authorization. Bound configuration and authorization freshness
explicitly; last-good operation is permitted only within that validity, never forever after revocation.
Expiry fails closed for authorization-dependent work. No timeout in seconds is invented here.
Safe enable/disable and supported configuration refresh must have defined lifecycle behavior.
Unsafe artifact-version/configuration transitions report restart-required rather than pretending to hot-reload.
Restart-required is an observable outcome, not a claim that a callback performed a restart.
Disable and shutdown withdraw readiness, stop admitting affected work, and dispose acquired resources.
Attempt all disposers even if one throws; cancellation must prevent late activation/reread completion.
Failures block required dependents, not unrelated extensions or every host of the logical plugin.

## Existing package evidence

| Surface today | Source evidence | Constraint |
| --- | --- | --- |
| `@ghost-shell/contracts` | [Exports/dependencies](../../packages/plugin-contracts/package.json#L8-L68) | Existing public subpaths; linked `@weaver/config-types` plus Zod; not already a clean portable graph |
| `@ghost-shell/plugin-system` | [Manifest](../../packages/plugin-system/package.json) and [index](../../packages/plugin-system/src/index.ts#L1-L55) | Root-only exports, contracts dependency, but root exports DOM mount/renderer helpers |
| `@ghost-shell/config-plugin-runtime` | [Manifest](../../packages/config-plugin-runtime/package.json#L8-L28), [index](../../packages/config-plugin-runtime/src/index.ts#L1-L27) | Root schema/lifecycle surface, contracts plus linked Weaver engine/types |
| Schema catalog | [Delegation](../../packages/config-plugin-runtime/src/plugin-config-catalog.ts#L3-L117) | Existing Weaver composition/registry reuse, not an independent engine |
| Configuration hooks | [Result contracts](../../packages/config-plugin-runtime/src/plugin-config-lifecycle-hooks.ts#L13-L63), [implementation](../../packages/config-plugin-runtime/src/plugin-config-lifecycle-hooks.ts#L179-L266) | Return events/changedKeys; not a published cross-process notification feed |
| Layer conventions | [Ghost layers](../../packages/config-plugin-runtime/src/ghost-layers.ts#L7-L13), [hook default](../../packages/config-plugin-runtime/src/plugin-config-lifecycle-hooks.ts#L141-L143) | Core/app/tenant/user/session versus default `module`; reconcile explicitly |
| Type dependency | [Catalog service](../../packages/plugin-contracts/src/plugin-config-catalog-service.ts#L6-L12) | Contracts imports adapter `ComposedSchemaEntry`; type backedge, not proof of an executable cycle |
| Browser federation | [Manifest](../../packages/federation/package.json#L24-L32) | React/UI dependencies and MF peer `^2.3.1`; not server-neutral |

Relevant Ghost package manifests currently say `0.0.0`; root/apps are private with no version.
This is local manifest evidence, not registry history. The lockfile resolves MF to `2.9.0`
([lock entries](../../bun.lock#L1017-L1033)), which is not a server compatibility proof.
[Shared metadata](../../packages/federation/src/federation-runtime.ts#L18-L37) hardcodes `0.0.0`/`^0.0.0`,
including [React adapter sharing](../../packages/federation/src/federation-runtime.ts#L79-L87).
Any future release must coordinate this metadata rather than only changing package versions.

Legacy host compatibility still uses `^1.0.0` in
[activation](../../packages/shell/src/plugin-registry-activation.ts#L23) and
[backend manifest](../../apps/backend/src/tenant-manifest.ts#L56-L59).
That host-contract range is independent of the proposed package capability milestone; do not reset it to 0.1.
Backend [dependencies](../../apps/backend/package.json) include file/link inputs;
[schema adapter build](../../packages/config-plugin-runtime/tsup.config.ts#L4-L7) externalizes linked inputs rather than bundling them.
Ghost's `@weaver/*` links versus current upstream `@weaver-conf/*` need published-resolution evidence.
Do not infer an automatic namespace migration or assume local links are publishable dependencies.

## Proposed package responsibility matrix

Names/subpaths below are tentative design boundaries, not exports added by this document.

| Package | Reuse / proposed responsibility | Excluded dependency |
| --- | --- | --- |
| `@ghost-shell/contracts` | Reuse; additive portable and typed host subpaths, foundational schema/result types; retain legacy subpaths | No adapter-to-contracts type backedge; no mandatory UI in portable closure |
| `@ghost-shell/plugin-system` | Reuse neutral validation, dependency/readiness and lifecycle mechanisms; isolate DOM helpers in a web subpath | No shell/UI dependency for neutral core |
| `@ghost-shell/config-plugin-runtime` | Retain schema catalog/hooks; explicit Weaver resolution/invalidation subpath | No shell, browser federation or new persistence engine |
| `@ghost-shell/server-host` | Tentative new scoped supervisor/request-service composition; inject loader and config adapters | No browser host import and no duplicate neutral runtime |
| Existing federation/shell | Independent web consumer; retain existing imports/exposes and behavior | No import into server composition |

Move the catalog service's shared type contract to a foundational boundary (or depend directly on an
appropriate foundational Weaver type), removing the adapter backedge without claiming a runtime cycle.
Do not silently break legacy imports while extracting portable entrypoints.
Keep the initial server MF adapter private to the integration proof; expose a new subpath/package only
if a clean dependency closure can actually be built. No speculative fifth public abstraction is required.

Proposed dependency direction (arrows mean “depends on”):

```text
neutral plugin-system  -> foundational contracts
Weaver config adapter  -> foundational contracts + published Weaver APIs
server-host            -> neutral plugin-system + injected adapters + host contracts
existing shell/web     -> contracts + web plugin-system + browser federation
```

Contracts sit at the bottom; server-host composes rather than owns configuration persistence.
Weaver is authoritative through the adapter; a generic runtime need not import Weaver or MF.
Portable/server entrypoint closures must exclude DOM/React/browser transitive imports in built output,
not merely omit browser calls at runtime. Type declaration closure must be portable too.

## Dependency-ordered milestones and ownership

| Milestone | Dependency / owner | Exit evidence |
| --- | --- | --- |
| Evidence and scope approval | Architecture/product; Weaver security owner before protected deployment | Runtime/trust/freshness decision, supported published Weaver API, actual read/stream authorization plan |
| Portable contracts | After scope; Ghost contracts owners | Foundational types, no adapter backedge, additive legacy-compatible exports |
| Core lifecycle | After contracts; Ghost runtime owners | Scoped readiness, dependency failure, cleanup and deterministic adapter tests |
| Weaver adapter | Parallel with core after contracts; Ghost config owners + upstream Weaver | Authorized effective reread, scope correctness, invalidation/recovery, bounded validity |
| Real remote server integration | After core + adapter; server owner, armada-gx8fv | Exact runtime/release and real remote candidate; two tenants, failure cleanup, no UI graph |
| Registry-consumer release checks | After integration; release owner | Clean install outside workspace, version/export/shared-metadata coordination, existing web regression |

Existing armada-i1oqr and armada-rwngs remain associated bridge/runtime follow-ups;
armada-gx8fv owns server artifact/lifecycle feasibility. Beads remains the task source of truth.
Weaver owners must address the stock authorization/recovery gaps; Ghost owns bridge policy and host behavior.
No upstream fix, implementation, publication, or milestone completion is claimed here.

## Proposed acceptance gates, not executed tests

| Risk | Required evidence before claiming 0.1 |
| --- | --- |
| Real loading | At least one remote server artifact on the exact selected runtime and loader release; not only a static fake |
| Admission | Zero entries execute no plugin code; required unsupported kinds fail locally; optional absence differs from load failure |
| Lifecycle | No false active/ready after failed load/init; partial registrations cleaned; every disposer attempted even if one throws |
| Isolation | Two tenants receive different effective config and distinct mutable state; no principal/credential retained across requests |
| Change correctness | Fake and real transport coverage: dropped, duplicate, reordered SSE hints, split chunks, reconnect/read races, override removal |
| Security/freshness | Protected reads/streams reject wrong scopes; no metadata leak; expiry/revocation fail closed; valid last-good bounded |
| Shutdown | Stop timers/subscriptions and pending work; no late activation or state update after disposal |
| Release closure | Registry-only consumer with no workspace/file/link dependencies; ESM and types resolve; no DOM transitive graph |
| Compatibility | Existing web imports, federation exposes, actions/config behavior and host-contract compatibility remain valid |

Require CommonJS consumer evidence only if that entrypoint is intentionally supported; ESM/types are mandatory.
Check registry version history before choosing bump semantics; 0.1 is not a blanket version reset.
Resolve actual published Weaver packages/capabilities and coordinate MF shared metadata before release.
Local source versions and a lockfile cannot substitute for that clean consumer proof.

Current shell synchronization tests mock local `onChange`, and backend configuration tests cover files,
not the proposed remote bridge. [Config lifecycle tests](../../packages/config-plugin-runtime/test/plugin-config-lifecycle-hooks.test.mjs#L3-L13)
and [schema bridge tests](../../packages/config-plugin-runtime/test/plugin-schema-bridge.test.mjs#L3-L17) are empty/skipped;
[shell setup tests](../../apps/shell/test/config-service-setup.test.mjs#L48-L65) have empty bodies
marked skipped in comments. Neither proves integration. This task runs documentation checks, not future gates.
No runtime code, package version, dependency, inventory, or changeset is changed by this proposal.

## Three decisions required

1. **Runtime:** prefer proving Bun, consistent with Ghost policy. Approve Node as the initial candidate only
   with an explicit policy exception and exact runtime/loader evidence; do not silently claim both work.
2. **Trust:** approve trusted, allowlisted code and scoped instances without sandbox claims, or expand scope
   to a separately designed isolation boundary before admitting untrusted plugins.
3. **Freshness:** choose configurable validity/expiry and revocation policy, including bounded last-good use
   and fail-closed behavior. Values remain unset; approval must not imply perpetual authorization caching.
