# Plugin runtime 0.1 product requirements

**Status:** Proposed / pending review — not accepted, implemented or shipped.
**Date:** 2026-09-30 · **Issue:** armada-7qumi.
**Context:** armada-48zqt, armada-fpclw and armada-jt1uv / PR170; unmerged base `76ac85e`.

This PRD supersedes the scope of the [historical proposal](./plugin-runtime-0.1-proposal.md).
The [ARB](./plugin-runtime-0.1-arb.md) gives proposed architecture and evidence constraints;
[future directions](./plugin-runtime-future-directions.md) preserves unscheduled ideas.
FR, AC and AR identifiers express requirements, acceptance and design traceability, not task status.
Beads remains the work tracker. Approval of these documents would not itself authorize publication.

## Product problem and users

B2B applications need tenant-specific behavior, not merely different theme settings.
One tenant may require additional validation providers, while another has a smaller graph
with different effective values. Hosting those graphs must not require adopting an entire
configuration platform, UI stack or telemetry backend.

| Persona | Need | Observable benefit |
| --- | --- | --- |
| Application developer | Embed the same neutral runtime in server, browser and CLI | Local provider invocation on each host with independently chosen adapters |
| Deployment operator | Assign plugins, constrain trust and see actual readiness | Desired configuration distinguished from admitted, applied and failed state |
| Plugin author | Publish discoverable definitions and separately built implementations | Metadata inspection without execution; explicit compatibility and activation contracts |

## Goals and exclusions

The proposed 0.1 proves portable discovery, scoped lazy activation and actual remote code
in three independent consumers. Two tenants must have different graphs and configuration.
Existing browser exports, federation integration and action/intents behavior remain compatible.
Standalone means no mandatory Weaver service, database, OTEL collector or Grafana stack.
It does not mean statically bundling the plugin or replacing code loading with a mock.

Non-goals: untrusted-code sandboxing, general multi-version coexistence, hot unloading,
distributed atomic activation, automatic RPC, rich TUI/Ink and a new action dispatcher.
Production Weaver integration is optional future work, not an installation prerequisite.
Basic admission security, package correctness and three-host runtime proof are not deferred.

## Functional requirements

### FR01 — Data-only discovery contracts

Keep an installation inventory separate from each immutable plugin definition manifest.
Inventory records assignment, effective enablement and selected bindings for the verified
host/tenant context; `catalog.available` is discoverability, not installation or permission.
The definition contains identity/release, contributions, configuration schema, dependency
and activation references. All executable entries are optional, including server entries.
A declarations-only plugin is valid and must not import code to discover or admit its data.
Use strictly validated JSON data, never eval, closures, executable schemas or discovery imports.

Configuration values are a private sideband, tied to the selected definition version and
plan revision. Reject mismatched or mixed revisions rather than guessing correspondence.
The Module Federation asset manifest is a loader detail, not either domain manifest.
Admission of a declaration with a provider reference never establishes provider readiness.

### FR02 — Source-neutral plans and separate adapters

The core consumes an already resolved, authorized plan through a narrow port.
A generic HTTP plan-source adapter is separately installable from npm and serves the
standalone fixture through that same port. No special demo-only resolution path is allowed.
It must not simulate Weaver's precedence rules inside core; a future Weaver adapter owns
effective reads and uses public APIs. Neither adapter is mandatory for other sources.
Source transport, optional invalidation hints and recovery remain adapter/caller concerns.

### FR03 — Metadata before code

List applicable contribution metadata before loading executable implementations.
Apply visibility and admission policy to discovery; portable does not mean public.
Distinguish available, installed, enabled, admitted, selected and ready in reporting.
A metadata request alone produces zero plugin executable downloads and zero activations.
Unknown required kinds reject affected scope; unsupported optional kinds diagnose and skip.

### FR04 — Real remote execution on three hosts

A web server, a real browser and a plain CLI each embed core and invoke their own local
validation provider. Browser and CLI must not merely forward execution to the server.
Each loads an independently built plugin artifact over real HTTP on first eligible demand.
The executable implementation is not bundled into any host or substituted by a test fake.
Module Federation is the initial loader candidate; exact Bun/browser support is a proof gate.
A separately installable loader adapter owns that dependency, not neutral core.

Fresh-cache evidence is mandatory: reset executable caches and record HTTP responses/bytes
for each host's first demand. A previously cached artifact alone does not satisfy real-download
acceptance. A separate warm-cache test may reuse verified artifact bytes but must still prove
scoped activation. Download counts and activation counts are distinct; MF may fetch multiple assets.

### FR05 — Lazy demand and existing actions

Support explicit startup activation and lazy capability/action demand over required dependencies.
Use existing actions/intents; do not replace their dispatcher or bypass action-path mutations.
Register metadata without loading lazy code. First demand loads and initializes once per
host/tenant/plugin scoped generation; repeated demand adds no activation in that generation.
Security-critical startup providers must be ready before protected actions are admitted.
Every protected invocation is authorized at its authoritative handler, not just at startup.

### FR06 — Tenant-specific graphs and invocation context

Tenant A selects base validation with its own title minimum-length configuration.
Tenant B selects base validation with a different minimum plus a reference-required plugin.
Use verified tenant context, never an arbitrary client-supplied tenant string as authority.
Mutable activation state and config are scoped; each call supplies its principal, transaction,
credentials and cancellation. Neither tenant state nor credentials live in module globals.
Artifact byte sharing does not imply shared mutable instances or request identity.

### FR07 — Lifecycle correctness

Distinguish absent, disabled, denied, unsupported, blocked, loading, activating, ready,
failed and stopped. Declaration-only admission and restart-required are explicit outcomes,
not aliases for readiness. Resolve required dependency closure before publishing providers.
Detect cycles, missing dependencies, initialization timeouts and thrown initialization failures.
Required dependents block; unrelated graphs continue. Optional integrations degrade explicitly.

Concurrent demand joins one activation flight per scoped generation. Consumer cancellation
releases only that consumer's lease; it cannot abort activation needed by other consumers.
When no demand remains, cancellation follows the host's defined ownership policy.
Disable and shutdown close admission, withdraw readiness and clean acquired resources.
Attempt all disposers even if one fails; report cleanup failures without skipping remaining work.
Prevent late async loads, initialization or plan reads from publishing after shutdown/supersession.

### FR08 — Observable state and human diagnostics

Provide typed lifecycle events and local snapshots for programmatic consumers.
Snapshots include desired/applied provenance, scoped generation, readiness and failure reasons.
Use `slf` with host-root `slf-debug` binding for human diagnostics, subject to all-host proof.
Do not parse debug logs as state, or promise JSON/structured-field preservation or OTEL parity.
Redact before submitting to the facade, including before any pre-factory queue.
The [ARB logging evidence](./plugin-runtime-0.1-arb.md#logging-evidence-and-gates) is binding to this proposal.

### FR09 — Updates, validity and honest revisions

Support source rereads and explicit configuration replacement where the plugin contract permits;
otherwise report restart-required. Artifact version changes may require process restart in 0.1.
Keep desired and applied revisions separate until application really succeeds.
Revisions are opaque provenance/equality tokens, not lexicographic ordering or atomic transactions.
Serialize/coalesce updates and reject superseded reads and mismatched sidebands.

Disable or expired grants gate new invocations even while a version/config change requires restart.
Use finite, explicit freshness/authorization validity and bounded last-good policy; expiry fails closed.
The demo supplies documented finite values and a deterministic clock, not an invented universal SLA.
Production values require approval. Source unavailability cannot renew validity indefinitely.

### FR10 — Independent consumers and release closure

Consumers install only selected adapters; neutral runtime and types exclude Weaver, DOM, React,
MF and OTEL backends. Preserve existing public exports while adding portable boundaries.
Prove built ESM and declaration consumption outside the workspace with no file/link/workspace edges.
Local packed artifacts can test builds; registry-resolved installation is a separate release gate.
Neither is satisfied by a workspace symlink. Check registry history before selecting package bumps.
Legacy host contract `^1.0.0` is independent of the proposed package milestone 0.1.
Bun is preferred for server/CLI and required as project runner; Node as initial runtime needs
explicit exception approval and exact runtime evidence, never an automatic fallback.

## Acceptance matrix

These are proposed automatable assertions, not results from this documentation change.
Counters are scoped by host, tenant, plugin and generation, not aggregated across the process.

| Acceptance | Requirement | Assertion and evidence | Design |
| --- | --- | --- | --- |
| AC01 | FR01 | Schema fixtures accept zero entries; reject malformed JSON, mismatched versions/sidebands; available-only never installs | AR01, AR02 |
| AC02 | FR02 | Public HTTP source fixture and alternate in-memory contract fixture feed same core port; standalone has no Weaver/DB/OTEL dependency | AR02, AR03 |
| AC03 | FR03 | Metadata request lists authorized contributions; executable network requests and activation counters remain zero; required/optional unknown kinds differ | AR01, AR04 |
| AC04 | FR04 | Three fresh-cache traces contain real HTTP executable responses from separately built artifacts; three local providers actually run | AR03, AR04 |
| AC05 | FR05 | First demand initializes once per scoped generation; repeat demand does not; startup security provider gates protected action; legacy action regression passes | AR04, AR05 |
| AC06 | FR06 | Two tenants produce different results and graphs in each host; concurrent calls cannot exchange config, credentials or mutable state | AR05 |
| AC07 | FR07 | Cycle, missing dependency, timeout, init throw, remote error, concurrent cancellation and shutdown races assert typed states and complete cleanup | AR04, AR05 |
| AC08 | FR08 | Typed snapshots/events show transitions; log capture excludes secret/config/document/raw-error sentinels; facade/driver runs on all three hosts | AR06 |
| AC09 | FR09 | Clock advance expires grants; disable blocks new work during restart-required; stale read cannot overwrite applied revision; sideband mismatch rejected | AR02, AR07 |
| AC10 | FR10 | Clean ESM/type consumers and dependency graph audit pass without workspace links; selected adapters only; existing web imports/exposes regressions pass | AR03, AR08 |

AC07 includes two consumers joining one flight, cancellation of one, success for the other,
and exactly one initialization. Shutdown during load/init produces no late provider publication.
Inject a throwing disposer before another disposer and assert both were attempted.
Timeouts use controlled clocks and declared fixture limits, not sleep-based performance claims.

## Demonstration specification

The following is a future interface specification, not existing commands or a runbook.
The future implementation owner supplies exact commands, ports, fixture paths and expected output.
After initial dependencies are acquired and artifacts built, the test uses local HTTP only;
no live registry, Weaver, database or telemetry service is needed for the demonstration.
Registry publication/consumer verification remains a separate release activity.

### Fixture and input contract

Serve strict inventory, immutable definitions, revision-bound config and executable artifacts
from a trusted loopback fixture. Pin artifacts and allowlist origins; verify correspondence
before evaluation. Signatures are not prescribed, but absence of a real verification mechanism
blocks claims of production security. Loopback reachability alone is not code admission.
The admitted-publisher model is trusted in-process code, not a tenant sandbox.

Use known JSON document fixtures loaded independently by each host: server reads its fixture,
browser fetches the fixture and validates locally, CLI reads the same fixture from a supplied path.
For example A uses title minimum 3, B uses minimum 8 plus reference-required.
A title of four characters without a reference passes A and fails B; a long title with a
reference passes both; an empty title fails both. These are fixture values, not product defaults.

The UI is a simple validation view, and CLI is plain text, not Ink.
CLI exits 0 for a valid document and nonzero for invalid input or execution failure,
with distinguishable diagnostics. Browser prechecks are advisory: bypass them and send invalid
input to the protected server action to prove server revalidation and authorization.

### Demonstration sequence and expected observations

| Scenario | Future operation | Expected evidence |
| --- | --- | --- |
| D01 discovery | Start all three hosts and fetch A/B metadata before demand | Different selected graphs, effective config provenance; zero lazy executable downloads/initializations |
| D02 demand | Validate fixtures in each host with fresh executable caches | Real local HTTP code downloads, each host's own provider result, one initialization per selected scoped generation |
| D03 reuse | Repeat and concurrently request validation in each running host | Same results, no extra activation; cancellation of one caller leaves another working |
| D04 tenant difference | Run short-title/no-reference and long-title/reference fixtures | A/B difference above; CLI exit contract, simple browser result, server authoritative result |
| D05 policy | Bypass browser precheck; request wrong tenant and protected work before security readiness | Server rejects invalid/unauthorized work; no cross-tenant metadata leak or premature protected execution |
| D06 update | Replace config revision, then request an artifact version change | Applied revision advances only on supported replacement; otherwise desired differs with restart-required; version conflict explicit |
| D07 freshness | Disable while restart-required, expire grant via clock, then interrupt source | New work denied/disabled at once or validity boundary as applicable; no perpetual last-good authorization |
| D08 failure | Fixture returns remote error; another artifact throws after partial init | Failed versus absent distinguished; required dependents blocked, unrelated providers available, resources released |
| D09 shutdown | Interrupt pending activation/read and inject disposer failure | No late publication; every disposer attempted; final snapshot reports stopped/cleanup failure accurately |

Single-version-per-plugin-per-process is the proposed 0.1 constraint. A/B use the same code
version with different config/graphs; conflicting version requests report conflict/restart-required,
not silent selection or a claim that tenant namespaces isolate module caches.
D03's repeat CLI case uses one process/session; separate CLI launches are separate generations.

## Release and review gates

Release requires lint, tests, typecheck and build gates using Bun; risk-based core contract tests
cover both tenants, lifecycle races, isolation and failures. Real remote end-to-end coverage must
include a genuine browser integration; a mock DOM or static fake loader alone is insufficient.
Require clean packed-artifact ESM/type smoke proof, then registry consumer proof and package graph
inspection. Preserve existing web exports, federation exposes, actions and configuration behavior.
Coordinate shared federation metadata with releases; do not reset legacy host compatibility.

Runtime, trust and freshness remain three explicit review decisions: exact Bun/loader versions
(or approved Node exception), trusted publisher admission/verification, and finite validity policy.
`slf`/`slf-debug` Bun/browser behavior is also a blocking integration gate: prove or adapt upstream,
not silently choose another logger. No benchmark or fixed performance SLA is invented here.
No runtime test, dependency change, package release or changeset is delivered by this PRD.
