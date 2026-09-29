# Plugin contract and plugin inventory

**Status:** Proposed / source assessment, not an accepted ADR.

**Date:** 2026-09-29 · **Revision:** 1

**Issues:** armada-jt1uv (documentation), armada-qtagh (preceding assessment).

Companion: [multi-target architecture assessment](./multi-target-architecture-assessment.md). Findings below are static source observations, including the supplied Explorer inventory and targeted source spot checks; they are not reproduced runtime failures. Recommendations do not establish finalized APIs.

## Contract taxonomy

| Contract | Today | Proposed boundary |
| --- | --- | --- |
| Logical identity and declarations | [`PluginManifestIdentity`](../../packages/plugin-contracts/src/types.ts#L18-L24), optional [`PluginContract` contributions/dependencies](../../packages/plugin-contracts/src/types.ts#L213-L260) | Common envelope for identity, dependency/configuration conventions and declarative capabilities; separate portable semantics from host-specific declarations. |
| Executable host contract | Shell contract mixes views, layers, themes, activation and runtime routes | Distinct typed server/web/TUI extensions, loaders, activation contexts, services, and disposal. Every executable entry is optional. |
| Deployment/discovery descriptor | [`TenantPluginDescriptor`](../../packages/plugin-contracts/src/types.ts#L267-L285) requires one `entry` | Describe available hosts independently of identity; no inferred server requirement or atomic multi-host deployment. |
| Backend extension | [`RedemeinePlugin`](../../packages/sentinel-redemeine/src/sentinel-plugin.ts#L6-L18) exposes `key` and `onBeforeCommand` | Retain typed backend semantics; consider an explicit adapter, not a browser API pretending to be universal. |
| Serialized versus runtime contract | [`PluginRouteContribution.params`](../../packages/plugin-contracts/src/types.ts#L235-L250) can carry runtime Zod values | Do not serialize the runtime object wholesale. Envelope format/version and schema representation remain open. |

Illustrative common-model combinations below are **not a proposed field syntax** or claims of implemented loading support. “Client service” describes execution location, not a backend service.

| Example | Server code | Web code | TUI code | Declarations / interpretation |
| --- | --- | --- | --- | --- |
| Server-only authorization extension | Optional selected entry | — | — | Common identity/config; backend interceptor contract. |
| Client service | — | Service entry | Optional service adapter | No visual component required; no server authority. |
| Declarations-only policy/config pack | — | — | — | Data-only external path proposed; currently not generally implemented. |
| Web-only visual plugin | — | View entry | — | Terminal explicitly unsupported; fallback where meaningful. |
| TUI-only command/list plugin | — | — | Terminal entry | Terminal is a client host. |
| Mixed domain plugin | Service entry | View entry | Compact view entry | Shared identity/semantics, independently authorized and activated hosts. |

## Retain / extract / adapt / add inventory

| Area | Disposition and evidence | Gap / recommendation |
| --- | --- | --- |
| Identity and helpers | **Retain / extract** [`definePlugin`](../../packages/plugin-contracts/src/define-plugin.ts#L3-L28) and [`createPluginContract`](../../packages/plugin-contracts/src/create-plugin-contract.ts#L14-L30). The former preserves types without validation; the latter derives `ghost.contributes` and omits `activations`. | Extract a common declarative envelope deliberately; helper identity is not runtime validation or complete metadata propagation. |
| Tenant discovery | **Adapt** duplicate [backend descriptor/parser](../../apps/backend/src/tenant-manifest.ts#L3-L63), [strict tenant schema](../../packages/plugin-contracts/src/schemas.ts#L389-L397), and [shell fallback](../../packages/shell/src/app/utils.ts#L80-L105). [Local UI discovery](../../apps/backend/src/local-ui-plugin-discovery.ts#L126-L137) manufactures federation manifest URLs. | Required single entry and web discovery prevent a general no-code external path. Add host-aware discovery without removing legacy `entry`. |
| Web loader | **Retain / adapt** [`createRuntimeFirstPluginLoader`](../../packages/shell/src/plugin-loader.ts#L97-L170) always registers a remote and loads its contract; component/service catches return `{}`. [Sidecar activation exports](../../packages/shell/src/plugin-loader.ts#L351-L383) are executable loading conventions. | Distinguish intentionally absent modules from failures; add separate host loaders rather than a universal federation loader. [Federation React/DOM sharing](../../packages/federation/src/federation-runtime.ts#L124-L168) stays web-local. |
| Activation and lifecycle | **Adapt** [`runActivateHook`](../../packages/shell/src/plugin-registry-activation.ts#L203-L225) returns before activation-rule resolution if hook/API is absent, uses `isSecondary: false`, and creates context without a service registrar. [`registerService`](../../packages/shell/src/plugin-api/ghost-api-factory.ts#L72-L94) throws without that registrar. | Static integration caveats, not proof of a runtime incident. Define host-local activation/service registration explicitly; do not assume rule-only activation or arbitrary service registration works here. |
| Dependency planning | **Retain / adapt** [activation sequencing](../../packages/shell/src/plugin-registry-activation.ts#L345-L416), [lifecycle transitions](../../packages/shell/src/plugin-registry-lifecycle.ts#L5-L58), and [startup plan](../../packages/shell/src/plugin-activation-plan.ts#L26-L56). [Capability validation](../../packages/plugin-system/src/capability-validation.ts#L141-L147) considers enabled, loaded providers. | Current startup event set is `onStartup`; define host-scoped dependency satisfaction and distinguish declared, loaded, enabled, and active states. |
| Capabilities and services | **Retain / adapt** [`CapabilityRegistry`](../../packages/plugin-system/src/capability-registry.ts#L38-L72); [loaded-only synchronous services](../../packages/shell/src/plugin-registry.ts#L32-L57) versus [async module resolution](../../packages/shell/src/plugin-registry-capabilities.ts#L119-L142). | Do not equate metadata registration with a service instance or remote RPC. Host-specific typed service contracts remain necessary. |
| Builtins | **Retain** [builtin registration](../../packages/shell/src/plugin-registry.ts#L127-L175) uses artificial `builtin://shell` routing. | This special local path is not general external declarations-only support. |
| Configuration | **Retain / extract / adapt** [configuration lifecycle](../../packages/config-plugin-runtime/src/plugin-config-lifecycle-hooks.ts#L49-L63) and [registration flow](../../packages/config-plugin-runtime/src/plugin-config-lifecycle-hooks.ts#L179-L265), versus [shell synchronization](../../packages/shell/src/plugin-config-sync-controller.ts#L48-L118). | Share schema/key conventions, not identical storage or privileges. [Backend bootstrap](../../apps/backend/src/config-bootstrap.ts#L28-L63) uses real Weaver storage; [`config-stubs`](../../apps/backend/src/config-stubs.ts#L1-L33) re-exports real implementations despite its name. |
| Actions/intents and UI | **Retain / extract** action/intent semantics; **adapt** DOM parts and host services. | Preserve existing dispatch. See [host and feature boundaries](./multi-target-architecture-assessment.md#2-host-boundaries); add terminal adapters, not a parallel action system or universal UI DSL. |
| Search/results | **Extract / adapt / add** schema-derived columns and manual query hooks. | Add shared criteria/query/results and a column-definition registry separate from renderers; authorize projection and full-dataset sort, validate preferences. See [search assessment](./multi-target-architecture-assessment.md#4-configurable-search-and-results). |

## Concrete plugins: what the examples establish

| Existing plugin | Evidence | Classification / limit |
| --- | --- | --- |
| `theme-default-plugin` | [Package metadata](../../plugins/theme-default-plugin/package.json#L6-L15), [contract expose](../../plugins/theme-default-plugin/src/plugin-contract-expose.ts#L1-L4) | Declarative contribution without activation hook, but still a JS remote contract; not external code-free loading. |
| `action-palette-plugin` | [`activate`](../../plugins/action-palette-plugin/src/plugin-activate.ts#L7-L28) | Client quickpick/action integration. Keep action semantics; adapt presentation/input for terminal. |
| `ghost-motion-plugin` | [Service expose](../../plugins/ghost-motion-plugin/src/plugin-services-expose.ts#L60-L72) | Client animation service, not evidence of a server plugin. |
| `domain-vessel-view-plugin` | [`activate`](../../plugins/domain-vessel-view-plugin/src/plugin-activate.ts#L3-L15) | Logging stub; does not establish an implemented end-to-end domain flow. |
| `sentinel-redemeine` | [`createSentinelPlugin`](../../packages/sentinel-redemeine/src/sentinel-plugin.ts#L54-L120), [typed config/errors](../../packages/sentinel-redemeine/src/types.ts#L20-L70) | Real backend authorization interceptor with distinct host contract. [Existing test evidence](../../packages/sentinel-redemeine/tests/sentinel-plugin.test.ts#L87-L100) was inspected in discovery, not run for this documentation change. |

[Backend provider/route bootstrap](../../apps/backend/src/index.ts#L81-L116) is further evidence of a real backend integration surface, not a general shell-style server plugin loader.

## Validation and discovery drift

These mismatches make a new canonical envelope a compatibility project, not just a TypeScript rename:

- Type-level action/keybinding `hidden`, slot `when`, contract `displayName`, and `routes` appear in [types](../../packages/plugin-contracts/src/types.ts#L84-L105), [slots](../../packages/plugin-contracts/src/types.ts#L184-L196), and [contract/routes](../../packages/plugin-contracts/src/types.ts#L231-L259), but corresponding [action/keybinding schemas](../../packages/plugin-contracts/src/schemas.ts#L129-L154), [slot schema](../../packages/plugin-contracts/src/schemas.ts#L271-L279), and [contribution/contract schemas](../../packages/plugin-contracts/src/schemas.ts#L350-L380) omit them.
- Tenant types include `activationEvents`/`contributes`, while the strict tenant schema omits them. Actual [bootstrap](../../packages/shell/src/app/bootstrap.ts#L51-L54) uses the [permissive utility parser](../../packages/shell/src/app/utils.ts#L114-L148); strict schema findings must not be presented as proof that bootstrap rejects those fields.
- [Schema generation metadata selection](../../scripts/build-config-schemas.mjs#L12-L38) and [configuration extraction](../../scripts/build-config-schemas.mjs#L59-L69) read `ghost.configuration` or top-level `contributes.configuration`, unlike runtime `ghost.contributes` derivation.
- [Backend discovery](../../apps/backend/src/local-ui-plugin-discovery.ts#L123-L124) [rejects duplicates](../../apps/backend/src/local-ui-plugin-discovery.ts#L201-L205), whereas [dev-host discovery](../../apps/plugin-dev-host/src/plugin-discovery.ts#L38-L55) [warns and keeps the first](../../apps/plugin-dev-host/src/plugin-discovery.ts#L124-L129). A common discovery policy is not already present.

## Compatibility and migration

The public surface includes [`plugin-contracts` package exports](../../packages/plugin-contracts/package.json#L8-L55), its [index exports](../../packages/plugin-contracts/src/index.ts#L15-L45) and [additional exports](../../packages/plugin-contracts/src/index.ts#L79-L108), [generated plugin contract template](../../templates/plugin-app/src/plugin-contract-expose.ts.template), [starter federation exposes](../../plugins/plugin-starter/vite.config.ts#L15-L40), and [contribution composition](../../packages/plugin-system/src/composition.ts#L69-L119). Preserve these consumers through additive adapters and explicit version negotiation rather than silently changing existing meanings.

A staged proposal is to establish the serializable envelope and validation parity first, retain legacy web descriptors through normalization, then introduce a host adapter and declarations-only discovery, and finally prove selected terminal features. Existing [builtin registry tests](../../packages/shell/src/shell-runtime/plugin-registry-builtin.spec.ts#L19-L51) and [table compiler tests](../../packages/table-from-schema/src/compile-table-fields.test.ts#L14-L71) are useful regression seeds, not evidence that proposed multi-host behavior is covered.

Future contract tests should distinguish missing entrypoints from failed loads, verify no execution for declarations-only packages, preserve legacy imports/exposes, exercise host-local activation and cleanup, and validate query authorization/fallbacks. No production migration or test execution is part of this assessment.

**Open decisions:** envelope format/version; initial server host adapter; host-local versus global enablement/dependencies; trust and cross-host transport; query provider semantics; and an Ink/Formbar integration proof. Shared identity must never be interpreted as shared privileges or a distributed activation transaction.
