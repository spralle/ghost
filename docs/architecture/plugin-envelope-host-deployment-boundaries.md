# Plugin envelope, host, and deployment boundaries

**Status:** Proposed — decision requested; not an accepted ADR or executable schema.

**Date:** 2026-09-29 · **Issue:** armada-fpclw

**Predecessor:** armada-jt1uv / PR170 (open), commit `76ac85e`.

This proposal assigns ownership, not field syntax or implementation work.
It builds on the [multi-target assessment](./multi-target-architecture-assessment.md)
and [contract and plugin inventory](./plugin-contract-and-plugin-inventory.md).
Those documents retain the source evidence; recommendations below are not current runtime guarantees.

## Current evidence and scope

Today, the external web descriptor requires an entry and the loader imports a remote contract.
The [inventory](./plugin-contract-and-plugin-inventory.md#retain--extract--adapt--add-inventory)
records the loader, validation, activation, and discovery gaps that an additive migration must address.
The legacy theme plugin still exposes executable JavaScript remotely: absence of an activation hook
does not make it an existing external zero-code path.

Proposed: every executable entrypoint is optional, including server; zero entries is valid.
A declaration-only plugin undergoes validation and admission without executing plugin code.
This does not replace existing actions/intents or make host-local services into RPC.
Implementation, version syntax, serialization/schema design, RPC tooling, security mechanisms,
server adapters, and the Ink choice remain outside this decision.

## Ownership model

| Boundary | Owner and contents | Explicitly excluded |
| --- | --- | --- |
| Portable envelope | Plugin author, under platform rules: identity/namespace, envelope release identity, configuration declarations, contributions, logical dependencies, extension descriptors | Deployment URLs, secrets, granted privileges, runtime readiness |
| Typed host contract | Platform: accepted contribution kinds and validators, activation/context lifecycle, compatibility rules, scoped APIs | Universal browser API, deployment selection, plugin self-granted authority |
| Extension descriptor | Author: stable logical extension ID/artifact key, execution role, required capabilities, supported host contract, provided semantics, extension-local dependencies | Code, physical location, observed readiness |
| Executable implementation | Author: code implementing a selected host contract | Self-granted privileges, authority to redefine operator policy |
| Deployment binding | Operator: artifact key to actual locators and selected artifact versions, host installation, enablement, policy/trust, configuration values, secret references | Semantic rewriting of author declarations, runtime readiness |
| Runtime state | Host runtime: observed admission, selection, dependency resolution, loading, activation, provider readiness, failure, cleanup | Author-declared success or inferred remote activation |

Portable means transferable between compatible hosts, not universally public.
Keep the full envelope distinct from a safe client projection: private server metadata,
configuration declarations/values, and deployment locations must not leak into client discovery.
Configuration key/schema conventions may be shared; storage, values, visibility, and authority need not be.
Secret references belong to deployment, and resolved secrets never belong in portable declarations.

## Host and execution boundaries

Execution role, presentation target, and process runtime are separate dimensions.
A Node-based TUI is a client, not a server by virtue of running Node.
Shared schema/metadata is not a universal service API.

| Host scope | Proposed contract boundary |
| --- | --- |
| Client behavior | Client-local services and actions without requiring UI or a window API |
| Web presentation | DOM mounts, browser focus/windows, layers and disposal remain web-specific |
| TUI presentation | One host owner for terminal root, input, focus, resize and cleanup; extensions participate rather than starting competing input/raw-mode loops |
| Server | Registration lives for the host/extension lifespan; request principal, transaction and cancellation are supplied per invocation, never captured as global activation context |

Retain existing intent/action dispatch, including action-path mutation requirements.
Local service registration exposes a local provider only; remote access requires an explicit service
contract and authorized transport, not a shared plugin ID or automatic proxy generation.

## Identity, artifacts, and compatibility

Authors assign stable logical extension IDs and artifact keys within the plugin namespace.
Operators bind those keys to environment-specific URLs/artifacts; authors do not bake deployment
locations into portable semantics. Binding may select implementations but may not rewrite their meaning.

Keep five version concerns distinct:

- Envelope schema version governs interpretation of the portable representation.
- Plugin definition/envelope release identity identifies a particular declaration set.
- Executable artifacts can release independently for each extension/host.
- Host API contract versions govern activation and scoped host integration.
- Service contract versions govern provider/consumer semantics, including cross-host use.

Compatibility is a checked relationship, not equal version numbers or a plugin-ID match alone.
A selected artifact must correspond to its declared extension and satisfy the declared host/service
contracts. Deployment locations must meet host/operator policy constraints before loading.
The correspondence verification mechanism and version numbering/negotiation syntax are deferred;
this document does not claim signing, isolation, or artifact verification is implemented.

## Contributions and dependencies

Contribution kinds should be namespaced, discriminated data with validators accepted by the host.
Make the contribution owner and provider connection explicit: a declaration is not an executing handler.
A declaration may reference an external compatible provider and need no executable implementation itself.

The proposed portable representation is pure data: no React nodes, closures, or Zod instances.
The exact serializer/schema remains undecided. Existing runtime validation must be adapted deliberately;
current TypeScript contracts and runtime schemas do not already establish this envelope contract.

A required unknown kind fails the affected admission scope; an optional unsupported kind is skipped
with a diagnostic. Neither is silently dropped. Affected scope follows explicit dependency edges,
not an automatic failure of every host belonging to the same plugin.

Dependencies are extension-local by default; logical-plugin-wide dependencies require explicit scope.
Distinguish required edges from optional integrations. Missing required providers block their dependents;
missing optional providers permit declared degraded behavior without blocking unrelated extensions.
A cross-host dependency names a service contract, authorized transport, and observed availability.
It never implies remote installation, deployment, or activation.

## Admission, enablement, and lifecycle

Operator eligibility and extension enablement are distinct from feature toggles, user preferences,
host capability support, and per-user authorization. None of those declarations grants privileges.
Enabling a feature does not automatically activate every extension in its logical plugin.
Current policy must be enforced at the domain action/query handler on each invocation;
hidden UI and successful admission are not substitutes for authorization.

Proposed flow:

`validate → policy admit → select eligible extensions → resolve bindings/dependencies → load → activate → observe ready → cleanup`

For zero-code declarations, bypass code loading/activation, not validation, policy, dependency checks,
or observation of any referenced provider. Admission of data alone does not prove a provider ready.

| State/outcome | Meaning and required distinction |
| --- | --- |
| Absent | No entry/provider declared or available; optional absence is acceptable where declared |
| Disabled | Operator has not enabled an otherwise eligible extension |
| Denied | Policy refuses admission or an invocation; do not relabel as unsupported |
| Unsupported | Host lacks a declared kind/capability or presentation adapter; required versus optional rules apply |
| Blocked | A required dependency is not ready; report the dependency-local cause |
| Failed | A selected load/activation/provider operation failed; never return an empty success |
| Ready | Required provider behavior is observed available under its contract, not merely declared or activated |

Loading and activation are intermediate observations, not synonyms for readiness.
If a provider disappears, withdraw its ready state and update/block dependent operations with diagnostics.
Partial activation must release registrations and resources already acquired; cleanup also applies on
disablement and teardown. Failures propagate along required dependencies rather than unrelated hosts.
There is no distributed atomic activation promise, and no claim of cross-host rollback.

## Representative combinations and admission scenarios

These are proposed acceptance examples, not executed tests or field syntax.

| Combination | Expected boundary behavior |
| --- | --- |
| Declaration-only configuration pack | No server, web, or TUI code; validate and admit data, apply permitted configuration declarations without importing plugin JavaScript |
| Client service only | Client behavior with no visual component or server entry; receives only its host-scoped service APIs |
| Server domain/query only | No UI entry; lifespan registration, per-invocation principal/transaction/cancellation and handler authorization |
| Mixed search | Independently released server/client artifacts must satisfy compatible query contracts; missing server blocks dependent search, not unrelated local actions |
| Web-only specialized result cell | TUI uses an authorized semantic text fallback where meaningful; otherwise the view is unavailable, not a whole-plugin crash |

Search criteria, result fields and custom column definitions describe query semantics separately from
host renderers. User visibility/order preferences select only currently permitted fields; stale preferences
must be revalidated. Server projection, filtering and sorting enforce field/resource permissions,
and sorting covers the full authorized dataset before pagination. Fallback must never reveal unauthorized
values or metadata. See the [search assessment](./multi-target-architecture-assessment.md#4-configurable-search-and-results).

| Admission/runtime scenario | Expected outcome |
| --- | --- |
| Required unknown contribution kind | Reject affected scope with diagnostic; block its required dependents |
| Optional unsupported contribution kind | Skip with diagnostic; retain unrelated supported behavior |
| Policy denies selected extension | Denied, not absent/unsupported; no code loading for that rejected extension |
| Declared, selected artifact fails to load | Failed with cause/recovery information; not the optional-absence path or empty success |
| Activated provider never becomes ready | Not ready; required consumers remain blocked despite activation completion |
| Ready provider disappears | Readiness loss is observable; dependent operations fail/block appropriately and cleanup follows contract |

## Decision request

Non-negotiable constraints: authorization remains at the authoritative handler; declarations cannot
grant privileges; clients must not receive private server data; locators must meet deployment policy;
artifacts must correspond to declarations; load failures and readiness loss must not masquerade as success.
Security mechanisms remain open, but these obligations are not optional product defaults.

The following five product boundaries are **recommended, pending approval**:

| Boundary | Recommendation | Alternative and tradeoff |
| --- | --- | --- |
| Identity versus location | Author-owned IDs/artifact keys with operator-bound locators | Environment-specific URLs in author definitions simplify direct loading but couple portable semantics to deployment |
| Release coupling | Independently released, compatibility-checked artifacts | Lockstep envelope/artifact releases simplify initial matching but force coordinated release cycles |
| Dependency and enablement scope | Extension-local defaults with explicit logical-wide edges | Plugin-wide defaults simplify administration but unnecessarily block unrelated hosts/features |
| Admission and visibility | Required unknown kinds fail affected scope, optional kinds diagnose/skip; explicit safe client projection | More permissive optional-kind admission needs equally visible diagnostics; separate public/private author manifests add maintenance. Silent required-kind acceptance or private-data exposure is not acceptable |
| Readiness exposure | Expose dependency-local observed readiness to consumers/operators; explicit remote contracts and scoped authorization | Aggregate host-level health is simpler but less diagnostic; it must still gate consumers on real provider readiness. Declaration-equals-ready and unauthenticated invocation are not alternatives |

Approval would settle ownership/default boundaries only, not authorize runtime implementation.
Still open: representation and package boundaries, version numbering/negotiation, correspondence checks,
specific transport/security tooling, initial server adapters, and renderer/Ink feasibility.

## Additive migration boundary

Preserve existing web defaults, imports, federation exposes, action identities, and configuration behavior.
A future compatibility adapter can map a legacy descriptor `entry` into a web deployment binding while
keeping existing web contracts usable; do not require server or TUI entries from existing plugins.
Separate portable data from executable contracts and adapt validation before claiming a zero-code path.
Host-scoped admission, failure reporting, safe projections and readiness need future implementation evidence.
No runtime code, inventory revisions, executable schema, or migration is delivered by this document.
