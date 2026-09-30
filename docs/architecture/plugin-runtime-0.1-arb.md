# Plugin runtime 0.1 Architectural Review Brief

**Status:** Proposed / pending review — no accepted decisions or shipped implementation.
**Date:** 2026-09-30 · **Issue:** armada-7qumi.
**Context:** armada-48zqt, armada-fpclw, armada-jt1uv / PR170; unmerged base `76ac85e`.

ARB means **Architectural Review Brief**, a label chosen for this document, not an existing
repository convention. It accompanies the [PRD](./plugin-runtime-0.1-prd.md) and supersedes
recommendations in the [historical proposal](./plugin-runtime-0.1-proposal.md).
[Future directions](./plugin-runtime-future-directions.md) are not release commitments.
AR identifiers below are proposed design decisions, not accepted ADRs or work items.

## Ownership and trust boundaries

| Owner | Responsibility | Not authority for |
| --- | --- | --- |
| Plugin author | Immutable definition, contribution/config schemas, activation references and logical artifact identity | Deployment eligibility, credentials or self-granted permission |
| Deployment operator/source | Installation inventory, effective enablement, artifact bindings and private config sideband | Claiming a provider actually initialized |
| Host composition root | Verified tenant context, eligibility, plan reads, loader selection, local provider port and observation | Reimplementing source precedence or trusting arbitrary request tenant IDs |
| Neutral core | Data validation, dependency resolution, scoped lifecycle/readiness and typed observations | Weaver scopes, DOM, React, MF mechanics or OTEL backends |
| Authoritative handler | Per-invocation authorization and domain validation | Assuming UI visibility or admission already authorized the request |

An inventory may originate from a fixture or Weaver; core sees resolved plans in either case.
Keep private configuration and deployment metadata out of public discovery projections.
Secret references are resolved only by an authorized host boundary and never by portable metadata.
Contribution/provider metadata is not invocation authorization and does not prove readiness.

Artifact byte cache keys describe immutable identity/integrity and loader compatibility.
Activation scope describes host/service, verified tenant, plugin and generation.
Request identity describes principal, credentials, transaction and cancellation for one call.
These are distinct lifetimes: shared bytes must not share mutable tenant instances or authority.
Configuration scope is not activation lifetime. Do not capture a tenant in mutable module globals.

## Proposed decision table

| Design | Recommendation | Alternative and cost | Traceability |
| --- | --- | --- | --- |
| AR01 | Separate installation inventory, immutable definition and version-bound private sideband | One executable manifest is simpler to author but defeats safe discovery and mixes ownership | FR01, FR03; AC01, AC03 |
| AR02 | Core consumes source-neutral resolved plans; independently installed HTTP source | Mandatory Weaver or fake core precedence couples consumers and misrepresents source authority | FR01, FR02, FR09; AC01, AC02, AC09 |
| AR03 | Reuse contracts/core; separate source and loader npm packages with audited closures | Private-only adapters reduce packaging effort but fail independent-consumer requirements | FR02, FR04, FR10; AC02, AC04, AC10 |
| AR04 | Demand closure, single-flight activation and explicit readiness states | Eager activation wastes work; declaration-equals-ready conceals failure | FR03, FR04, FR05, FR07; AC03–AC05, AC07 |
| AR05 | Scoped mutable instances plus request-local authority; trusted in-process publishers | Per-request activation is expensive; untrusted workers add a separate isolation design | FR05, FR06, FR07; AC05–AC07 |
| AR06 | Typed events/snapshots; injected logging bound to slf at host root | Parsing debug output couples correctness to backend formatting; mandatory OTEL adds vendor burden | FR08; AC08 |
| AR07 | Serialized reconciliation, finite validity, honest desired/applied revisions | Unlimited last-good hides revocation; general hot replacement exceeds safe 0.1 guarantees | FR09; AC09 |
| AR08 | Three real hosts plus clean consumer proof before release | Static mocks/workspace links are cheaper but cannot prove runtime or publication correctness | FR04, FR10; AC04, AC10 |

Recommendations remain reviewable; unacceptable shortcuts are not endorsed alternatives.
The traceability table is read with the PRD's full automatable acceptance matrix.

## AR01 — Data and admission

Strict JSON parsing and schema validation precede any code evaluation.
Validate identity, immutable definition version, selected artifacts and sideband correspondence.
Do not run code to obtain contribution metadata or configuration schema.
All executable entries are optional, including server; declarations-only admission skips load/init.
Unknown required contribution kinds reject affected scope. Optional unsupported kinds emit diagnostics.
Plan selection, missing optional implementation, unsupported host, denied policy and failed load
are separate outcomes. Referenced providers still require observed availability.

Installation assignment/effective enablement is distinct from `catalog.available`.
Author definitions describe semantics; deployment bindings locate artifacts without rewriting semantics.
The loader's MF manifest is below this boundary and cannot substitute for an installation inventory.
Keep validation and safe client projection explicit; even schema/metadata can contain private details.

## AR02 — Conceptual ports, not finalized APIs

| Port/value | Conceptual contract | Boundary constraint |
| --- | --- | --- |
| Plan source | Read authorized resolved plan for verified host/tenant context; typed failure/validity | Adapter owns source transport, effective resolution and recovery |
| Optional source hints | Signal invalidation/recovery opportunity | Never authoritative state; callers reread and handle races |
| Resolved plan | Definition references, selection, private sideband, bindings and provenance | Reject mixed revisions; no opaque executable callbacks from source |
| Loader | Admit pinned reference, download/load selected implementation, return typed result | Loader reference is not an MF type in core public API |
| Host/provider port | Register scoped capability, invoke with explicit request context, dispose | No implicit remote proxy or dispatcher replacement |
| Clock/logger/observer | Inject time, diagnostic sink and typed observation delivery | No required logging driver or telemetry backend in core types |

These describe data/control responsibilities, not promised method names or export paths.
A source may expose reads alone; optional hints must not make a specific SSE/SCOMP transport mandatory.
Caller composition owns scheduling and adapter lifetime; core owns applying validated generations.
Polling must reach authoritative refreshed data, not perpetually renew an unchanged stale cache.

Record source revision, artifact identity and authorization provenance separately.
Revision comparison means identity/equality plus caller generation, never lexical time ordering.
No cross-registry atomicity is claimed. If inventory/definition/config cannot be coherently bound,
reject the candidate and retain only still-valid prior state, with a visible diagnostic.

## AR03 — Package and dependency proposal

Four essential responsibility rows below are not a promise of exactly four packages.
Names of new packages are placeholders pending export/registry review, not current releases.
Split loader packaging if subpaths cannot establish a clean independent graph.

| Surface | Proposal | Required closure |
| --- | --- | --- |
| `@ghost-shell/contracts` | Evolve portable subpath and narrow typed boundaries; preserve existing exports | Remove adapter type backedge; portable declarations exclude unchosen vendor/UI types |
| `@ghost-shell/plugin-system` | Evolve neutral core; isolate existing DOM helpers behind web entrypoint | Neutral built JS and types depend on portable contracts, not DOM/React/Weaver/MF |
| NEW `@ghost-shell/http-plan-source` | Independently installable generic HTTP resolved-plan source | Contracts and portable HTTP concerns only; fixture is an ordinary consumer |
| NEW `@ghost-shell/mf-loader` | Independently installable loader with browser/server subpaths only if graph-clean | Server closure excludes browser/React; browser closure excludes server-only runtime APIs |
| CONDITIONAL separate browser/server loader packages | Split preceding row if package-level dependency graph cannot be clean | Independent installation must not pull unchosen runtime dependencies |
| CONDITIONAL `@ghost-shell/server-host` | Extract only if genuine reusable supervision exists | Compose core and ports; do not force one public npm package per demo |
| FUTURE independent Weaver plan-source adapter | Effective plan reads, authorized transport and recovery | Published Weaver API, never mandatory neutral dependency |
| Existing `@ghost-shell/config-plugin-runtime` | Retain schema catalog/composition/hooks responsibilities | Do not relabel schema machinery as an already implemented plan source |
| Existing browser federation | Preserve web imports, exposes and behavior | Not a server-host or neutral-core dependency |
| Private demonstration applications | Three host apps plus fixture/artifact server and separately built plugins | Integration consumers, not public package-count commitments |

Dependency direction is consumer → chosen adapter → portable contracts, and core → contracts.
Host composition joins source, loader and core; contracts must not depend back on adapters.
An unused subpath is insufficient if installing its package still forces unchosen vendor dependencies.
Audit installed manifests, built imports and declaration closure, not just source-level imports.

The historical proposal's [package evidence](./plugin-runtime-0.1-proposal.md#existing-package-evidence)
records current export/dependency gaps, `0.0.0` manifests, MF lock/shared metadata and host `^1.0.0`.
Its old package/milestone tables are superseded, not implementation instructions.
No automatic version reset or namespace migration follows from this proposal.

## AR04 and AR05 — Demand, lifecycle and isolation

Select eligible contributions, resolve required dependency closure and detect cycles before loading.
Initialize dependencies before publishing dependents as ready; readiness is observed behavior.
Track absent/disabled/denied/unsupported/blocked separately from loading/activating/failed/ready/stopped.
Keep initialization timeout and provider-readiness failure explicit, not empty success results.
Security startup providers gate protected calls; a lazy non-security provider cannot bypass policy.

One activation flight owns each scoped generation. Requests hold leases/reference counts on demand;
cancelling one releases its interest without cancelling work needed by others.
Host shutdown can cancel the entire generation. Completion checks generation/disposed state before
publication; acquired resources from late or failed work still receive cleanup.
This is local lifecycle coordination, not a global transaction framework.

Dispose partial registrations after failure. Continue cleanup after individual disposer failures,
aggregate typed diagnostics and block required dependents without poisoning unrelated graphs.
Disable closes admission and withdraws readiness before asynchronous cleanup completes.
Shutdown stops reads/hints/timers, blocks new calls and prevents late publication.
Request cancellation and any draining policy must not imply undoing external side effects.

The 0.1 proposal permits one version of a plugin per process, with separate tenant instances.
Different requested versions produce an explicit conflict/restart-required outcome; do not silently
reuse the first loaded module or claim per-tenant module namespaces solve runtime cache conflicts.
Trusted code can access process resources: tenant namespacing is not a sandbox.
Allowlisted publishers/origins, pinned artifacts and verified correspondence precede evaluation.
The loopback fixture is trusted, but strict parsing, origin control, pinning and redaction still apply.
No signing implementation is mandated; production security claims require an actual admission mechanism.

## AR06 — Observation and logging

Typed lifecycle events and local snapshots are authoritative programmatic runtime state.
Logs explain human failures, not a distributed registry, billing ledger or machine-readable API.
Core takes a narrow injected diagnostic interface; composition can bind `slf` without requiring
`slf-debug` or an OTEL backend in core dependencies/public types.
The selected demonstration integration is `slf` plus `slf-debug`, not an interchangeable silent fallback.

### Logging evidence and gates

Explorer checked registry metadata and source on 2026-09-30; no runtime execution is implied.
[slf latest metadata](https://registry.npmjs.org/slf/latest) identified **2.1.0**, Simple Logging Facade,
from `surikaterna/slf`, `packages/slf`.
[slf-debug latest metadata](https://registry.npmjs.org/slf-debug/latest) identified **0.3.2**,
with `debug ^4.3.4` and peer `slf ^2.0.0`. Latest URLs are mutable observation sources.

Both reported `main: lib/index.js` and `types: lib/index.d.ts`, with no `exports`, `browser`,
`module`, `type`, `engines` or `sideEffects` metadata. This does not prove Bun/browser support.
Pinned source: [facade](https://github.com/surikaterna/slf/tree/42f199bfe04dd43d5d536466eaf418f0d4b4e29a/packages/slf)
and [driver](https://github.com/surikaterna/slf/tree/1ab5a80e7d8e9a08752a0ddd7cb9296c4e1f9931/packages/slf-debug).
[debug 4.3.4 README](https://github.com/debug-js/debug/blob/4.3.4/README.md) describes the dependency
range floor, not the actual resolved version for a future consumer.

Verified API: named `LoggerFactory` from `slf`, default `slfDebug` from `slf-debug`,
`LoggerFactory.setFactory(slfDebug)` and
`LoggerFactory.getLogger("ghost:plugin-host").info("Plugin ready")`.
The host composition root installs the factory before use; plugins cannot replace it or
switch the global logger per tenant. Factory installation does not enable debug namespaces.
`SLF_LOG_LEVEL` controls facade threshold (source default Debug); `DEBUG=ghost:*` enables backend
namespaces in the relevant process environment. Browser enabling must use a verified browser
adapter mechanism, not an assumption that process environment variables exist there.

Facade source accesses `global.__slf` and `process.env`, and queues logs before a factory exists.
Prove imports, factory binding, output and missing-factory queue behavior on Bun server, Bun CLI
and the real browser build. Do not infer portability from TypeScript declarations.
If incompatible, gate release pending explicit upstream adaptation and fresh proof;
do not silently swap the logger or assume broad polyfills are harmless.

Redact **before** submitting to the facade/queue. Exclude raw configuration values, secrets,
document payloads, auth headers and raw errors/stacks by default; stacks can contain sensitive data.
Allow only approved opaque tenant identifiers for correlation, with safe error categories/codes.
No JSON or structured-field preservation/backend-format compatibility is promised.
SLF/debug is human diagnostics, not an OTEL replacement; metric cardinality policy is future work.

## AR07 — Reconciliation and validity

Coalesce and serialize rereads; associate accepted results with local generation identity.
Where hints exist, account for read/subscribe races and reconnect by authoritative reread.
Do not assume the source exposes recovery it does not implement.
Desired revision records the candidate; applied revision changes only after supported application.
Explicit config replacement may be supported; unsafe config/artifact changes report restart-required.
Never report restart-required as if a process restart actually occurred.

Revocation/disable closes new admission even when an older artifact remains loaded pending restart.
Freshness and authorization have finite configured validity; last-good operation is bounded by both.
The fixture uses a deterministic injected clock to prove expiry without a production SLA guess.
Production policy values and the authority that can renew them remain approval decisions.
No hot unload, global rollback or atomic config/artifact/policy transaction is promised.

## AR08 — Proof, compatibility and review

Use contract tests for strict parsing, metadata-only discovery, required/optional dependencies,
single-flight leases, timeouts, partial cleanup, cancellation, revision races and tenant isolation.
Use actual HTTP artifacts in three hosts; each invokes its own provider on known document fixtures.
Capture fresh-cache network traces before/after demand, then repeated-call activation counts.
Browser automation must drive a real browser, not rely solely on mock DOM tests.
Remote-error and init-throws fixture variants exercise real failure boundaries and disposer failures.

Clean consumer gates inspect built ESM and declarations outside workspace linkage, then registry
resolution before release. Check package version history, compatibility ranges and MF shared metadata.
Existing web exports/exposes, actions and config behavior require regression tests alongside
lint, typecheck, tests and builds. CJS proof is required only if intentionally supported.
There is no package, dependency, version or changeset edit in this documentation issue.

Review must settle exact runtime/loader releases (Bun preferred; Node requires approved exception),
trusted-publisher verification and finite freshness policy. Logging compatibility is a release gate.
The [preserved inventory](./plugin-contract-and-plugin-inventory.md) and
[host boundaries](./plugin-envelope-host-deployment-boundaries.md) retain migration evidence.
The [Weaver assessment](./weaver-change-notification-assessment.md) retains upstream limitations;
it does not make Weaver mandatory for this standalone scope.
