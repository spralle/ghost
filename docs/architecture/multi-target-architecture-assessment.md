# Multi-target architecture assessment

**Status:** Proposed / source assessment, not an accepted ADR.

**Date:** 2026-09-29 · **Revision:** 1

**Issues:** armada-jt1uv (documentation), armada-qtagh (preceding assessment).

This proposal separates current Ghost evidence from recommended boundaries. It does not introduce APIs or assert current Formbar TUI availability. The companion [plugin contract and inventory assessment](./plugin-contract-and-plugin-inventory.md) supplies contract taxonomy, concrete plugins, compatibility surfaces, and migration gaps.

The follow-up [plugin envelope, host, and deployment boundaries](./plugin-envelope-host-deployment-boundaries.md) requests ownership/default decisions; it is not an accepted ADR or executable schema.

## 1. Contract taxonomy before rendering

**Proposed:** one logical plugin envelope describes identity, dependency and configuration conventions, with distinct typed contracts for server, web client, and terminal client hosts. Every executable entrypoint is optional, including server. An external declarations-only plugin should be possible without importing JavaScript; that path is not implemented today. Shared metadata does not imply shared privileges, co-deployment, or atomic distributed activation.

The common layer should describe neutral application semantics: action identities, intent context, capability requirements, configuration declarations, navigation intent, and domain/query contracts. It should not expose browser windows, terminal streams, backend storage, or a universal rendering object. Host-local modules implement these semantics through typed activation contexts, services, loaders, and disposal lifecycles. A terminal is a **client**, not a server merely because both can run outside a browser.

**Current evidence:** [`PluginContract` and `PluginContributions`](../../packages/plugin-contracts/src/types.ts#L213-L260) already permit absent contributions but mix semantics with web views, layers, themes, slots, and popout capabilities. [`GhostApi`](../../packages/plugin-contracts/src/ghost-api.ts#L12-L27) requires actions, windows, views, and workspaces; its [window/popout conventions](../../packages/plugin-contracts/src/ghost-api.ts#L246-L288) are client/shell-oriented, not a universal backend service API.

## 2. Host boundaries

| Boundary | Recommended ownership | Evidence / constraint today |
| --- | --- | --- |
| Neutral application layer | Action/intent semantics, query types, capability identities, configuration conventions | Preserve [`action-surface`](../../packages/commands/src/action-surface.ts#L49-L145) and [`intent-runtime`](../../packages/intents/src/intent-runtime.ts#L138-L212), rather than adding another command system. |
| Web host | DOM mounts, browser focus, windows, layers, CSS tokens, web loading | [`PartRenderer` contracts](../../packages/plugin-contracts/src/plugin-services.ts#L45-L70), [`define-react-parts`](../../packages/react/src/define-react-parts.ts#L15-L23), and [`jsonform-capability`](../../packages/plugin-contracts/src/jsonform-capability.ts#L21-L37) have DOM boundaries. |
| Terminal host | Terminal renderer, focus/input routing, resize, output, cleanup | Proposed new host; exactly one terminal root/input/lifecycle owner. Plugins mount within that owner, not independent raw-mode/stdin loops. |
| Server host | Trusted service loading, authorization, persistence, command/query execution | Existing [`createSentinelPlugin`](../../packages/sentinel-redemeine/src/sentinel-plugin.ts#L54-L120) is a typed backend interceptor, not a shell plugin. Adapt deliberately rather than passing it `GhostApi`. |

React is not synonymous with DOM. Some hooks/state logic may transfer, but the current DOM part contract and React/TanStack widgets do not become terminal-compatible by using React. Ink is a **provisional renderer option**, not a confirmed Formbar implementation or a chosen dependency. A focused proof should exercise dense results, keyboard focus, resize, cancellation, accessibility, and teardown before choosing it. No claim about the latest sibling Formbar release or implementation is made here.

Formbar should own form semantics—schema interpretation, field state, validation, and submission—while Ghost owns application composition and host integration. Web and terminal adapters can consume compatible form semantics without Ghost duplicating a form engine. Defer a universal UI DSL; selective semantic contracts for forms, lists, commands, and navigation are a smaller, testable boundary.

## 3. Feature semantics and partial parity

Limited TUI parity is valid. A plugin may expose only a command, read-only summary, or compact list on terminal while retaining a richer web view. Host support must be explicit, distinct from permission checks and runtime failures.

| Situation | Proposed behavior |
| --- | --- |
| Authorized value, unsupported decorative cell renderer | Use semantic text/number/date/enum fallback for that cell; retain the surrounding results. |
| Required view capability absent, no meaningful semantic adapter | Show a whole-view unavailable placeholder with an explanation or supported alternative. |
| Unauthorized action, field, or resource | Enforce policy and avoid revealing protected values/metadata; never call this merely “unsupported.” |
| Supported module fails to load | Report a load failure with appropriate recovery, not a successful empty module or unsupported-host label. |

Use existing action/intent dispatch for mutations and user operations. [`intent-runtime`](../../packages/intents/src/intent-runtime.ts#L58-L79) already delegates chooser, activation, and announcements to host integration. Conversely, [`normalizeContext`](../../packages/commands/src/action-surface.ts#L211-L216) stringifies facts: it is not a structured query RPC or result transport.

## 4. Configurable search and results

**Proposed shared semantics:** a typed criteria/query/result contract covering filters, sorting, pagination, and stable result identity; a **column definition registry** separate from the **cell renderer registry**. Column definitions describe field identity, label, value semantics, allowed operations, projection requirements, and default visibility/order. Cell renderers supply host-specific presentation for those definitions. Neither registry replaces the query provider.

User preferences may select, hide, and reorder authorized columns, but must be validated against the current schema and permissions on load and use. Stale or unauthorized fields cannot be restored by a saved preference. Target hints such as pixel widths, card slots, terminal cell widths, truncation, and density belong in local presentation adaptations, not authoritative query semantics.

The provider/server must authorize field projection as well as filtering and sorting. Server-side sorting operates on the full authorized dataset **before** pagination, not just the loaded page. The contract must state pagination/cursor stability, cancellation, errors, and supported operators; client-local operations are appropriate only when completeness and semantics are explicit. Transport and provider APIs remain open decisions.

**Existing building blocks, not a complete search contract:**

- [`table-from-schema` types](../../packages/table-from-schema/src/types.ts#L9-L107) and [`createTableConfig`](../../packages/table-from-schema/src/create-table-config.ts#L9-L30) provide reusable field/filter/column metadata, but also pixel/card hints.
- [`compile-table-fields`](../../packages/table-from-schema/src/compile-table-fields.ts#L26-L31) stores order; [`deriveSearchable`](../../packages/table-from-schema/src/compile-table-fields.ts#L208-L210) infers searchability from string/enum types, without a searchability override. [`toColumnDefs`](../../packages/entity-table/src/to-column-defs.tsx#L24-L64) maps input order to React/TanStack columns: stored order does not establish enforced ordering.
- [`entity-list-types`](../../packages/entity-table/src/entity-list-types.ts#L55-L145) exposes external/manual query hooks, not a standardized end-to-end provider. [`use-menu-operations`](../../packages/entity-table/src/use-menu-operations.ts#L16-L30) already dispatches through Ghost menus; preserve this path.

## 5. Additive adoption and unresolved decisions

Preserve existing web plugins, imports, federation exposes, action identities, and configuration behavior through a compatibility adapter. Separate serializable declarations from executable modules before adding terminal loading. Do not require existing plugins to add server or TUI entries. Host support and enablement should be observable independently of load, activation, permission, and failure states.

The [inventory and migration section](./plugin-contract-and-plugin-inventory.md#compatibility-and-migration) identifies affected public surfaces. Future validation should cover legacy web fixtures, external declarations without code execution, host-specific dependency resolution, cleanup, permission-safe fallbacks, schema evolution, and full-dataset query ordering. These are proposed acceptance boundaries, not tests run by this assessment.

**Open decisions, not finalized APIs:**

- Envelope serialization format, version negotiation, and relation to package metadata/runtime contracts.
- Initial server adapter: integrate an existing backend host or introduce a dedicated extension loader?
- Global versus host-local enablement, dependency/version resolution, and partial-host failure reporting.
- Trust, signing/isolation, deployment, and authenticated cross-host transport. A shared plugin ID confers no authority.
- Query provider ownership, operator semantics, pagination consistency, and column permission metadata.
- Ink feasibility and the actual Formbar adapter boundary, to be established by a proof rather than assumed.
