# Weaver-owned configuration service facade for Ghost

Status: upstream design request for `armada-v82a.16`. This document does not
describe an API that is available today and does not authorize implementation,
publication, or a release.

## Decision requested

Weaver should own and publish a small public facade that supplies the three
capabilities Ghost currently obtains from legacy linked packages:

1. `createConfigurationService`
2. `createScopedConfigurationService`
3. `createServiceConfigurationService`

The names and final package root are negotiable. The capabilities and semantics
below are not. A preferred shape is an additive export from an existing
browser-safe Weaver root such as `@weaver-conf/config-runtime`, with Node-only
providers continuing to come from `@weaver-conf/storage-providers`. Weaver may
instead choose another clearly supported public root.

This must be a Weaver-owned API. Ghost must not add a wrapper or compatibility
facade, import private Weaver files, copy Weaver internals, or weaken policy
checks. Weaver should not restore deleted `@weaver/config-providers` or
`@weaver/config-server` package names merely to keep old imports compiling.

## Current evidence

This snapshot was checked against Ghost commit `ee56d5e` and Weaver commit
`ba5fef4` on 2026-09-18.

- Ghost's backend awaits `createConfigurationService` and then creates a
  namespace/reload adapter with `createServiceConfigurationService`
  ([`apps/backend/src/config-bootstrap.ts:70-79`](../../apps/backend/src/config-bootstrap.ts#L70-L79)).
  The backend's current metadata already uses the public `x-weaver` extension
  ([`config-bootstrap.ts:23-42`](../../apps/backend/src/config-bootstrap.ts#L23-L42)).
- Ghost's shell derives a plugin namespace and calls
  `createScopedConfigurationService`
  ([`packages/shell/src/config-service-registration.ts:54-59`](../../packages/shell/src/config-service-registration.ts#L54-L59)).
  Its public plugin contract re-exports the Weaver service types
  ([`packages/plugin-contracts/src/config-service.ts:6-14`](../../packages/plugin-contracts/src/config-service.ts#L6-L14)).
- Ghost tooling now imports declared linked package roots, not private `dist`
  files: schema collection imports `@weaver/config-engine` and
  `@weaver/config-types`
  ([`scripts/config-declarations.mjs:1-4`](../../scripts/config-declarations.mjs#L1-L4));
  generation and policy validation dynamically import public roots
  ([`scripts/build-config-schemas.mjs:16-23`](../../scripts/build-config-schemas.mjs#L16-L23),
  [`scripts/validate-change-policies.mjs:12-18`](../../scripts/validate-change-policies.mjs#L12-L18)).
  These are still `link:` dependencies
  ([root `package.json:40-44`](../../package.json#L40-L44)), so this is not
  registry-only consumer proof.
- The shell and backend still name linked legacy packages
  ([`packages/shell/package.json:24-44`](../../packages/shell/package.json#L24-L44),
  [`apps/backend/package.json:5-13`](../../apps/backend/package.json#L5-L13)).
  Development aliases also resolve Weaver source directly
  ([`apps/shell/vite.config.ts:82-86`](../../apps/shell/vite.config.ts#L82-L86),
  [`vitest.config.ts:41-45`](../../vitest.config.ts#L41-L45)).
- The published `@weaver-conf/config-engine@0.1.2` root declaration still omits
  all nine functions tracked by `armada-5yzo`: `deriveContractFromPackageJson`,
  `deriveNamespace`, `qualifyKey`, `validateKeyFormat`, `resolveConfiguration`,
  `inspectKey`, `composeConfigurationSchemas`, `generateJsonSchema`, and
  `generateZodSchemaSource`. The
  [published root declaration](https://unpkg.com/@weaver-conf/config-engine@0.1.2/dist/index.d.ts)
  and current
  [`packages/config-engine/src/index.ts:1-53`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/index.ts#L1-L53)
  expose `createSchemaRegistry` but not those nine functions, even though their
  implementations exist in
  [`contract-derivation.ts`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/contract-derivation.ts#L28-L40),
  [`namespace.ts`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/namespace.ts#L9-L70),
  [`layers.ts`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/layers.ts#L21-L65),
  [`schema-registry.ts`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/schema-registry.ts#L243-L270),
  and the
  [JSON](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/json-schema-generator.ts#L220-L240)
  and
  [Zod](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-engine/src/zod-schema-generator.ts#L123-L145)
  generators. This export work remains a separate issue from the facade
  requested here.
- Registry requests for
  [`@weaver-conf/config-providers`](https://registry.npmjs.org/@weaver-conf%2fconfig-providers)
  and
  [`@weaver-conf/config-server`](https://registry.npmjs.org/@weaver-conf%2fconfig-server)
  returned HTTP 404. Published replacements are
  `@weaver-conf/storage-providers@0.1.2` and
  `@weaver-conf/weaver-server@0.1.4`; their published roots provide storage and
  server primitives but none of the three factories
  ([storage declaration](https://unpkg.com/@weaver-conf/storage-providers@0.1.2/dist/index.d.ts),
  [server declaration](https://unpkg.com/@weaver-conf/weaver-server@0.1.4/dist/index.d.ts)).
  This is not a scope-only package rename.
- `createWeaverConfigService` is useful server infrastructure, but it is not a
  drop-in equivalent. Its public service has asynchronous reads, layer-first
  writes, deltas, revisions, and refresh/flush operations
  ([`packages/weaver-server/src/core/config-service-types.ts:32-69`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/weaver-server/src/core/config-service-types.ts#L32-L69)).
  Ghost's consumed `ConfigurationService` contract has synchronous hydrated
  reads, key-first writes, per-key subscriptions, and session exposure
  ([`packages/config-types/src/service.ts:33-61`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-types/src/service.ts#L33-L61)).

`armada-shpm` is verified and establishes usable Weaver issue tracking. It does
not provide any missing package or export.

## Consumer-to-capability matrix

| Consumer | Current dependency | Required facade capability | Compatibility boundary |
| --- | --- | --- | --- |
| Ghost backend | Root factory, filesystem providers, service-scoped adapter, schema metadata | Asynchronous provider hydration; deterministic layer and tenant resolution; synchronous post-hydration reads; awaited typed writes; provenance; policy/audit; hot versus restart-required notifications | Server-safe entry may use Node providers, but the facade contract and types remain provider-neutral |
| Shell and plugin contracts | `ConfigurationService`, `ScopedConfigurationService`, namespace derivation, service registration | Stable type ownership; namespace confinement; explicit immutable scope paths; synchronous reads; per-key subscriptions; read-only plugin access by default | No plugin can escape its namespace or bypass root policy through the scoped adapter |
| Browser/runtime and persistence bridges | In-memory degraded service, local persistence, session controller | Browser-safe bundle; sync cached reads after async initialization; explicit write completion/failure; user/view/session scopes; expiry notifications; deterministic teardown | No Node built-ins in browser exports; remote-only async clients remain a separate, clearly typed API |
| Policy and schema tooling | Engine/schema roots, `x-weaver`, policy validator | Public schema composition/generation exports under `armada-5yzo`; the facade consumes the same schemas for write denial and reload behavior | Tooling may use public roots directly; it does not need or justify a Ghost facade |

## Required contract

### Shared ownership and timing

`@weaver-conf/config-types` should remain the source of truth for service,
provider, scope, inspection, session, and `WriteResult` types. A facade package
may re-export those types deliberately, but must not fork structurally similar
copies.

Creation of the root service is asynchronous because providers load
asynchronously. After that promise resolves, Ghost needs synchronous reads from
the hydrated local snapshot. Initialization must either fail with a typed error
or explicitly report degraded providers; it must not silently produce an
apparently healthy service. A transport whose reads are inherently asynchronous
should keep the existing asynchronous client/server contract instead of being
cast to this facade.

Writes and removes must be awaitable and return a typed result. A failed or
denied write must not mutate the effective snapshot, emit a success change, or
hide behind a fire-and-forget callback. Successful completion must identify the
accepted layer and revision where available. Ghost can then update current
callers that assume a synchronous `void` remove or ignore the promise from set.

### 1. Root configuration service factory

The root factory must:

- accept public `ConfigurationStorageProvider` instances, a Weaver layer
  definition, optional session provider, and explicit environment/scope
  identity;
- preserve configured precedence across fixed layers, ordered scope/tenant
  layers, and higher-priority session/runtime layers;
- require tenant and other scope identity to be explicit at the boundary rather
  than sharing cached values across identities;
- expose effective reads, layer reads, namespace reads, scoped reads, and
  inspection with effective layer and all contributing layer values;
- apply schema validation and policy before storage mutation, including
  `changePolicy`, `maxOverrideLayer`, `writeRestriction`, `sessionMode`, actor,
  roles, tenant/scope, and active-session context;
- return a typed policy denial (for example `POLICY_DENIED`) without writing,
  optimistic mutation, or a success event, and emit the corresponding audit
  decision when auditing is configured;
- emit a per-key change only when the effective value changes, including after
  provider reload, external provider change, session expiry, or remove;
- return idempotent unsubscribe functions and own every provider subscription,
  watcher, debounce timer, and session timer it creates; and
- expose deterministic synchronous or asynchronous disposal that unsubscribes,
  flushes if required by contract, stops timers/watchers, and rejects later
  writes with a typed disposed result.

The current Weaver property model already defines reload and policy metadata
under `x-weaver`
([`packages/config-types/src/property-schema.ts:21-25`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-types/src/property-schema.ts#L21-L25),
[`property-schema.ts:83-95`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-types/src/property-schema.ts#L83-L95)).
The facade should consume that model, not introduce Ghost-specific metadata.

### 2. Scoped configuration service factory

This factory is a synchronous, I/O-free adapter over an initialized root
service. It must validate and capture one namespace, qualify relative keys
exactly once, reject absolute/path-escaping keys, and delegate reads,
inspection, policy, and subscriptions to the root.

`withScope` must return an immutable adapter bound to an ordered public
`ScopeInstance[]`; tenant identity is part of that path and must not be inferred
from ambient global state. `forView` must preserve both namespace and explicit
view/instance identity. Scoped plugin access should remain read-only unless
Weaver exposes an explicitly authorized write capability. If a root reference
is exposed for compatibility, root writes must still enforce the same policy.
Unsubscribe and disposal must release subscriptions created through the scoped
adapter without disposing a root service it does not own.

### 3. Service configuration factory

This factory is also a synchronous adapter over an initialized root. It must
bind a service namespace and its schema map, provide relative reads and
subscriptions, and permit cross-namespace reads only through an explicit
access-policy decision.

For `reloadBehavior: "hot"`, accepted changes notify normal subscribers without
setting restart state. For `"restart-required"` and `"rolling-restart"`, the
adapter sets `pendingRestart` and emits one restart-required transition until an
explicit acknowledgement/reset. Session expiry or rollback must be evaluated
the same way as any other effective-value change. The adapter must unsubscribe
all schema-key listeners when disposed.

### Session behavior

The facade may accept Weaver's existing override-session provider; it should not
duplicate it. Activation, extension, deactivation, and expiry must preserve
actor, reason, tenant/scope identity, expiry, and audit information. Session
values only participate when the schema permits them. Deactivation, expiry, and
root disposal clear ephemeral overrides and notify affected effective-value
subscribers. Weaver's current controller already has explicit lifecycle and
`dispose()`
([`packages/config-sessions/src/override-session-provider.ts:30-39`](https://github.com/surikaterna/weaver/blob/ba5fef44e196731d60798c8f806c81fdce6f7255/packages/config-sessions/src/override-session-provider.ts#L30-L39));
the facade must wire that lifecycle into its own disposal contract.

### Browser and server compatibility

The core facade and scoped/service adapters must bundle for browsers without
`node:` imports. Browser consumers can combine them with Weaver's local-storage
or in-memory providers. Server consumers can combine the same contract with
filesystem, Git, or MongoDB providers. Environment-specific providers belong in
their existing packages; the facade must not import every provider eagerly.
Both environments must observe the same precedence, policy, result, session,
subscription, and disposal semantics.

## Proposed API examples (not current API)

The package location, option names, method signatures, and reset method below
are illustrative. They are not available from current published packages.

```ts
import {
  createConfigurationService,
  createScopedConfigurationService,
  createServiceConfigurationService,
} from "@weaver-conf/config-runtime"; // proposed location only
import { createFileSystemStorageProvider } from "@weaver-conf/storage-providers";

const root = await createConfigurationService({
  providers: [
    createFileSystemStorageProvider({
      id: "tenant",
      layer: "tenant:acme",
      filePath: "tenant.json",
      writable: true,
    }),
  ],
  weaverConfig,
  identity: {
    environment: "production",
    scopePath: [{ scopeId: "tenant", value: "acme" }],
  },
  schemas,
  policy,
  session,
});

const plugin = createScopedConfigurationService(root, {
  namespace: "ghost.vesselMap",
  scopePath: [{ scopeId: "tenant", value: "acme" }],
});

const backend = createServiceConfigurationService({
  configService: root,
  namespace: "ghost.backend",
  schemaMap: backendSchemas,
});

const result = await root.set("ghost.backend.port", 8787, {
  layer: "tenant:acme",
  actor: { id: "operator-1", roles: ["platform"] },
});
if (!result.success) handleWriteDenial(result.error);

backend.acknowledgeRestart();
plugin.dispose();
backend.dispose();
await root.dispose();
```

## Upstream acceptance evidence

Facade implementation is acceptable only when Weaver can provide all of the
following evidence.

1. Build each affected package, pack it, install only the tarballs into an empty
   temporary consumer, and verify root ESM import, CJS `require`, and strict
   TypeScript declaration resolution. Tests must resolve files from the packed
   artifacts, not the Weaver workspace.
2. Verify the three factory capabilities from the chosen public root. No test or
   example may use a private subpath, source alias, undeclared export, copied
   implementation, `link:`, `workspace:`, or global package link.
3. Exercise precedence and provenance, explicit tenant/scope isolation, sync
   post-hydration reads, successful and failed writes/removes, policy denial with
   no mutation, provider load failure/degraded reporting, and revision results.
4. Exercise namespace confinement, scoped/view identity, subscription ordering
   and unsubscribe idempotence, external reload, hot reload, both restart modes,
   restart acknowledgement, session activation/extension/deactivation/expiry,
   and full disposal with no later event or timer leak.
5. Bundle and execute a browser fixture with a browser-safe provider, and execute
   a server fixture with a Node provider. The browser artifact must not pull in
   filesystem, MongoDB, Git, or other Node-only modules.
6. After publication, install exact registry versions into a second clean
   consumer with an empty cache and no Weaver/Ghost checkout in resolution
   paths. Repeat ESM, CJS, declarations, browser, server, and behavior smoke
   tests from registry packages only.

## Work separation and migration sequence

1. Complete `armada-5yzo` as its own Weaver change: export and publish the nine
   engine functions from the supported root with declarations and packed-root
   tests. Do not hide this work inside the facade.
2. Implement and behavior-test the Weaver-owned facade as a separate change.
   Do not modify Ghost to imitate the missing API while this is pending.
3. Publish the affected canonical `@weaver-conf/*` packages and record exact
   versions and packed/registry evidence. An additive public API is a **minor**
   release by default (for the current `0.1.x` line, normally `0.2.0`) unless a
   release owner explicitly approves another semver treatment. This default also
   applies to additive root exports unless explicitly approved otherwise.
4. Under `armada-v82a.2`, migrate Ghost manifests and imports from legacy
   `@weaver/*` links to the supported published roots, adapt call sites to the
   agreed write/result and disposal contract, and remove source aliases. Do not
   add a Ghost compatibility facade.
5. Finish `armada-v82a.2` only after the clean registry consumer passes with no
   links, workspace dependencies, source aliases, private deep imports, copied
   internals, or deleted-package compatibility shims.

Preparation of this request can be implemented and audited independently.
`armada-v82a.2` remains blocked until publication and real no-link consumer
proof; current linked public-root success is necessary but not sufficient.
