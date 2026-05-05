# ADR: formbar architecture for schema-driven + headless forms

## Status

**Amended (2026-04-18)** — Added layout model (§13), schema optionality (§9), field extend+override (§9.1)

## Context

Armada needs a form system that is schema-driven and headless, with deterministic behavior and explicit contracts that independent agents can implement without chat context.

This document is normative. `MUST`, `SHOULD`, and `MAY` are used in the RFC 2119 sense.

## Decision Summary

formbar adopts a four-package architecture with explicit path/namespace contracts, typed stage policy, expression-driven UI behavior, deterministic validation and metadata merge rules, and versioned extension points.

The following prior architecture decisions are preserved and required:

- 4 packages: `@ghost/formbar-core`, `@ghost/formbar-from-schema`, `@ghost/formbar-react`, `@ghost/predicate`
- data namespace is default; UI namespace is explicit `$ui`
- both dot and JSON Pointer boundary path formats are supported
- `$ui/...` mixed style is rejected
- `uiStateSchema` is required if any `$ui` path is referenced
- expressions + `$ui` are baseline architecture (not optional)
- Standard Schema + function validators are in kernel
- JSON Schema adapter lives in `@ghost/formbar-from-schema`
- Zod typed `.meta({ formbar: ... })` is required; no `x-formbar` in Zod metadata
- raw JSON Schema `x-formbar` is allowed
- dual-source hints strategy is used
- `date`/`date-time` transform model stores canonical strings in state
- single `form.field(path, config)` with extend+override semantics
- `useForm` has conceptual parity with `createForm`
- CQRS integration exists via `onSubmit` only

## 1) Package Topology (Normative)

Implementation MUST use exactly these packages and responsibilities:

1. `@ghost/formbar-core`
   - canonical state model (`data`, `uiState`, `meta`, `issues`)
   - canonical path normalization + namespace resolution
   - expression/rule execution runtime
   - stage policy orchestration + validation envelope normalization
   - transform pipeline + middleware lifecycle + transactional commit
2. `@ghost/formbar-from-schema`
   - Standard Schema / JSON Schema ingestion
   - JSON Schema validator adapter
   - metadata/hints extraction and merge
   - compile/init checks (`uiStateSchema` requirements, path forms)
3. `@ghost/formbar-react`
   - React binding (`useForm`) over core API
   - selector/subscription hooks and renderer integration
   - accessibility contract helpers
4. `@ghost/predicate`
   - expression engine implementation
   - operator registry and execution

`@ghost/formbar-core` MUST remain framework-agnostic and MUST NOT depend on React.

## 1.1) Canonical `FormState` Ownership and Stage Relation (Normative)

`@ghost/formbar-core` MUST use this canonical state shape:

```ts
export interface FormState<S extends string = string> {
  data: unknown;
  uiState: unknown;
  meta: {
    stage: S;
    validation: {
      lastEvaluatedStage?: S;
      lastValidatedAt?: string; // ISO-8601 UTC
    };
    submission?: {
      status: 'idle' | 'running' | 'succeeded' | 'failed';
      submitId?: string;
      lastAttemptAt?: string; // ISO-8601 UTC
      lastResultAt?: string; // ISO-8601 UTC
      lastErrorCode?: string;
    };
  };
  issues: readonly ValidationIssue<S>[];
}
```

Ownership rules:

- `uiState` is consumer-authored and/or schema-declared form state.
- `uiState` is expression-visible via `$ui.*`.
- `meta` is engine-internal bookkeeping only and MUST NOT contain consumer-authored UI model.
- `uiState` MUST remain separate from `meta` (MUST NOT be nested under `meta`).

Stage relation rules:

- Workflow stage MAY be modeled in `uiState` (for example `uiState.stage`) when consumer domain logic requires it.
- Engine authoritative stage is `meta.stage`.
- Engine observability for validation stage is `meta.validation.lastEvaluatedStage`.
- Transient submit context MUST NOT mutate `uiState.stage` by default.
- Transient submit context MUST NOT mutate `meta.stage`.

## 2) Stage Model and Generic Policy Contract

### 2.1 Typed contract

`@ghost/formbar-core` MUST expose a generic stage policy contract. The stage model MUST NOT be hardcoded to only `draft|submit|approve`, even though that remains the default profile.

```ts
export type SubmitMode = 'persistent' | 'transient';

export interface StageTransitionRule<S extends string> {
  from: S;
  to: S;
  reason?: string;
}

export interface SubmitContext<S extends string = string> {
  requestedStage: S;
  mode: SubmitMode; // persistent = mutate stage; transient = temporary validation context
  actorId?: string;
  requestId: string;
  at: string; // ISO-8601 UTC
  metadata?: Readonly<Record<string, unknown>>;
}

export interface StagePolicy<S extends string> {
  readonly orderedStages: readonly S[];
  readonly defaultStage: S;
  isKnownStage(stage: string): stage is S;
  canTransition(from: S, to: S): boolean;
  describeTransition(from: S, to: S): StageTransitionRule<S> | null;
}
```

### 2.2 Default profile

Default policy profile MUST be:

- ordered stages: `['draft', 'submit', 'approve']`
- default stage: `draft`
- allowed transitions: `draft->submit`, `submit->approve`, `submit->draft`, `approve->submit`

### 2.3 Unknown stage behavior

If any API receives a stage string not recognized by the active policy, runtime MUST fail deterministically with typed code `FORMBAR_STAGE_UNKNOWN` and include the raw stage value. Unknown stages MUST NOT be coerced or silently ignored.

### 2.4 Submit outcome policy matrix

Submit handling MUST follow this matrix:

| Submit mode | Outcome | `uiState.stage` changes | `meta` submission/status changes | Issues retained after attempt |
|---|---|---|---|---|
| persistent | success | MAY change only if consumer/rules explicitly write `uiState.stage`; engine does not auto-write | MUST set `meta.stage=requestedStage`; MUST set `meta.validation.lastEvaluatedStage=requestedStage`; MUST set `meta.submission.status='succeeded'` with timestamps/submitId | MUST retain latest evaluated issues (typically empty on success) |
| persistent | failure | MUST NOT be engine-mutated | MUST keep `meta.stage` unchanged from pre-submit value; MUST set `meta.validation.lastEvaluatedStage=requestedStage`; MUST set `meta.submission.status='failed'` with timestamps/submitId/error code | MUST retain issues from failed evaluation |
| transient | success | MUST NOT be engine-mutated | MUST NOT mutate `meta.stage`; MUST set `meta.validation.lastEvaluatedStage=requestedStage`; MUST set `meta.submission.status='succeeded'` with timestamps/submitId | MUST retain latest evaluated issues (typically empty on success) |
| transient | failure | MUST NOT be engine-mutated | MUST NOT mutate `meta.stage`; MUST set `meta.validation.lastEvaluatedStage=requestedStage`; MUST set `meta.submission.status='failed'` with timestamps/submitId/error code | MUST retain issues from failed evaluation |

`activeStage` relation:

- In normal evaluation/validation, `activeStage = meta.stage`.
- In transient submit validation, `activeStage = SubmitContext.requestedStage` for that attempt only.

## 3) Path Grammar, Namespace Resolution, and Canonicalization

## 3.1 Canonical path type

All boundary paths MUST normalize to:

```ts
export type Namespace = 'data' | 'ui';
export type CanonicalSegment = string | number;
export interface CanonicalPath {
  namespace: Namespace;
  segments: readonly CanonicalSegment[];
}
```

## 3.2 Accepted boundary grammar

Boundary APIs MUST accept these forms:

1. **Data dot path** (namespace implied `data`)
2. **UI dot path** (explicit `$ui.` prefix)
3. **JSON Pointer** (always resolves to `data` namespace)

EBNF:

```ebnf
digit           = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
nonzero-digit   = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
index           = "0" | ( nonzero-digit , { digit } ) ;
dot-segment     = 1*( ALPHA / digit / "_" / "-" ) ;
dot-path        = dot-segment , { "." , dot-segment } ;
ui-dot-path     = "$ui" , "." , dot-path ;
pointer-segment = *( unescaped / "~0" / "~1" ) ;
pointer-path    = "/" , pointer-segment , { "/" , pointer-segment } ;
```

## 3.3 Unsupported forms (MUST reject)

- `$ui/...` (mixed namespace + pointer syntax)
- empty path (`""`)
- trailing dot (`a.`), leading dot (`.a`), or repeated dot (`a..b`)
- invalid pointer escapes (e.g. `~2`, bare `~`)

## 3.4 Namespace resolution rules

- `customer.email` => `data` namespace
- `$ui.customer.email.visible` => `ui` namespace
- `/customer/email` => `data` namespace
- `/ui/anything` => **data path**, not UI namespace

Important:

- JSON Pointer boundary paths MUST always resolve to `data` namespace in this version.
- Pointer namespace override is not supported in this version.
- `/ui/...` is a data path; UI namespace requires dot form (`$ui.*`).

## 3.5 Numeric segment semantics

- In **dot paths**, a segment matching `index` grammar (`0` or non-leading-zero integer) MUST be interpreted as numeric array index in canonical form (`number`).
- In **dot paths**, a numeric-looking object key (e.g. key `'0'`) is ambiguous and MUST be authored using JSON Pointer if string semantics are required.
- In **JSON Pointer**, segments are textual after RFC 6901 decode; canonicalization MAY convert to numeric index only when target container type is known array during read/write resolution.

## 3.6 Round-trip and canonicalization invariants

Given a valid boundary path `p`:

1. `parse(p)` MUST yield one canonical path `c`.
2. `toPointer(c)` then `parse(pointer)` MUST return canonical `c`.
3. `toDot(c)` then `parse(dot)` MUST return `c` only when dot-safe segments are representable without ambiguity.

If dot-safe encoding is not possible (special chars `.`, `/`, `~`, or ambiguous numeric-string keys), `toDot` MUST fail with `FORMBAR_PATH_NOT_DOT_SAFE`.

## 3.7 RFC 6901 decode notes

Pointer decode MUST apply in order:

1. `~1 -> /`
2. `~0 -> ~`

Any remaining `~` sequence MUST fail with `FORMBAR_PATH_INVALID_POINTER_ESCAPE`.

## 4) `uiStateSchema` Contract

- If any path reference uses `$ui`, `uiStateSchema` is REQUIRED.
- Missing `uiStateSchema` with any `$ui` usage MUST fail at compile/init time (`FORMBAR_UI_SCHEMA_REQUIRED`).
- `uiStateSchema` MAY be Standard Schema or JSON Schema.
- If no `$ui` reference exists, `uiStateSchema` MAY be omitted.

## 5) Expression and Rule Executable Semantics

Expressions + UI state are baseline architecture and MUST be available in the kernel.

## 5.1 Authoring format and compile contract

Accepted authored expression format at schema/metadata boundaries MUST be a Mongo-like predicate object (JSON object).

Compiler behavior:

- Input predicate object MUST compile to canonical `ExprNode` AST before runtime evaluation.
- Compile output MUST be deterministic for equivalent authored predicates.
- Runtime execution MUST consume only canonical AST (`ExprNode`), not raw authored predicates.

Implementations MUST expose stable parse/compile errors with canonical codes:

- `FORMBAR_EXPR_PARSE_INVALID_ROOT` (root is not an object)
- `FORMBAR_EXPR_PARSE_UNKNOWN_OPERATOR` (operator token not registered)
- `FORMBAR_EXPR_PARSE_INVALID_ARGUMENTS` (operator argument arity/shape invalid)
- `FORMBAR_EXPR_PARSE_INVALID_PATH` (invalid path token/reference)
- `FORMBAR_EXPR_COMPILE_UNSUPPORTED_LITERAL` (literal type unsupported)
- `FORMBAR_EXPR_COMPILE_AMBIGUOUS_OBJECT` (object cannot be disambiguated between literal and operator)

Error payloads SHOULD include source location/path when available.

## 5.2 Baseline expression AST contract

```ts
export type ExprNode =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'path'; path: string }
  | { kind: 'op'; op: string; args: readonly ExprNode[] };

export interface ExpressionDefinition {
  id: string;
  ast: ExprNode;
}

export interface RuleDefinition {
  id: string;
  when: ExprNode;
  writes: readonly RuleWrite[];
}

export interface RuleWrite {
  path: string;
  value: ExprNode;
  mode: 'set' | 'delete';
}
```

## 5.3 Operator contracts and coercion

- Operators MUST be pure and deterministic.
- Implicit JavaScript coercion is forbidden.
- `$eq`/`$ne` MUST use strict type+value equality.
- `$gt`/`$gte`/`$lt`/`$lte` MUST only compare like-typed operands (`number-number` or `string-string`), otherwise error `FORMBAR_EXPR_TYPE_MISMATCH`.

## 5.4 Null/undefined semantics

- `null` means explicit null value.
- missing path means `undefined` at evaluation boundary.
- operators MUST distinguish `null` from `undefined`.
- absent path access MUST NOT throw; it yields `undefined`.

## 5.5 Rule write constraints and conflict policy

- Rules MAY write only to whitelisted targets declared at compile step (`data` and/or `$ui` subsets).
- Multiple writes to the same canonical path in one iteration:
  - identical value writes: dedupe
  - different value or different mode: deterministic error `FORMBAR_RULE_WRITE_CONFLICT`

No last-write-wins behavior is allowed.

## 5.6 Convergence/fixed-point semantics

Rule execution MUST run until a fixed point (no net writes) or iteration guard is hit.

- default max iterations: `16`
- configurable upper bound MAY be lower but MUST be >= `1`
- if max reached without convergence: error `FORMBAR_RULE_NON_CONVERGENT`

Failure MUST be deterministic and include iteration count and participating rule IDs.

## 6) Validation Architecture and Issue Envelope

## 6.1 Validator model

- Kernel supports Standard Schema + function validators.
- JSON Schema validation is adapter-based in `@ghost/formbar-from-schema`.

## 6.2 Required issue envelope

```ts
export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue<S extends string = string> {
  code: string;
  message: string;
  severity: IssueSeverity;
  stage: S;
  path: CanonicalPath;
  source: {
    origin: 'standard-schema' | 'function-validator' | 'json-schema-adapter' | 'rule' | 'middleware';
    validatorId: string;
    adapterId?: string;
    ruleId?: string;
  };
  details?: Readonly<Record<string, unknown>>;
}
```

All fields above except optional ones are REQUIRED.

## 6.3 Deterministic ordering and dedupe

Issues MUST be sorted by:

1. stage order from active `StagePolicy`
2. severity (`error`, `warning`, `info`)
3. namespace (`data`, `ui`)
4. canonical path lexicographic
5. `code`
6. `source.validatorId`
7. `message`

Dedupe key MUST be:

`stage + severity + canonicalPath + code + source.origin + source.validatorId + message`

## 6.4 Conditional required support

Implementations MUST support all requiredness sources:

- JSON Schema `if/then/else`
- JSON Schema `dependentRequired`
- `oneOf` / discriminated unions
- expression-based requiredness

## 7) Metadata and Hints Merge Algorithm

Dual-source hints strategy is mandatory:

1. kernel defaults (lowest)
2. embedded metadata (`.meta({ formbar: ... })` or JSON Schema `x-formbar`)
3. external hints map (highest)

Zod metadata MUST use `.meta({ formbar: ... })`; `x-formbar` in Zod context MUST fail.

## 7.1 Merge-by-type rules

For each path key at precedence-ordered merge:

- `undefined`: treated as absent, contributes nothing
- `null`: explicit value, replaces target node
- scalar (`string|number|boolean`): replace target node
- object: deep merge recursively
- array: replace wholesale (no concat)

## 7.2 Same-precedence conflicts

At identical precedence, conflicting writes MUST fail with `FORMBAR_META_CONFLICT`:

- scalar vs different scalar -> conflict
- array vs different array -> conflict
- object vs non-object -> conflict
- object vs object -> recurse per key; conflict only where child conflicts occur

Structurally equal values are allowed and deduped.

## 8) Normative Runtime Algorithm (Action -> Commit)

For every dispatched action, runtime MUST execute in this order:

1. **Normalize input**: parse/normalize paths to canonical; reject invalid path/stage.
2. **Begin transaction**: capture immutable `prevState` snapshot.
3. **Middleware `beforeAction`**: MAY veto. Veto aborts transaction.
4. **Apply ingress/field transforms**: convert payload into canonical values.
5. **Apply base mutation**: write requested state change to transaction draft.
6. **Middleware `beforeEvaluate`**.
7. **Evaluate expressions and rules** to fixed point (Section 5.5).
8. **Middleware `afterEvaluate`**.
9. **Resolve active validation stage**:
   - persistent mode => current stored stage
   - transient submit mode => `SubmitContext.requestedStage` without persisting stage mutation
10. **Middleware `beforeValidate`**.
11. **Run validators** and normalize to issue envelope.
12. **Middleware `afterValidate`**.
13. **If submit action**: run `beforeSubmit`; MAY veto.
14. **Abort gate**:
    - if any veto or fatal runtime error: rollback full transaction (no partial writes)
    - else continue
15. **Commit atomically**: publish `nextState` in one step.
16. **Notify subscribers/selectors** with structural sharing.
17. **Middleware `afterAction`**.
18. **If submit action succeeded**: execute `onSubmit`, then `afterSubmit`.

Transactional semantics are all-or-nothing: runtime MUST NOT commit partial intermediate state.

## 9) API and Type Contracts (Minimal, Concrete)

```ts
export interface CreateFormOptions<S extends string = 'draft' | 'submit' | 'approve'> {
  schema?: unknown; // Standard Schema root — optional in core
  uiStateSchema?: unknown;
  initialData?: unknown;
  initialUiState?: unknown;
  stagePolicy?: StagePolicy<S>;
  validators?: readonly ValidatorAdapter<S>[];
  expressionEngine?: ExpressionEngine;
  middleware?: readonly Middleware<S>[];
  transforms?: readonly Transform[];
  onSubmit?: (ctx: SubmitExecutionContext<S>) => Promise<SubmitResult>;
}

export interface FormApi<S extends string = string> {
  getState(): FormState<S>;
  dispatch(action: FormAction): FormDispatchResult;
  setValue(path: string, value: unknown): FormDispatchResult;
  validate(stage?: S): ValidationIssue<S>[];
  submit(context?: Partial<SubmitContext<S>>): Promise<SubmitResult>;
  field(path: string, config?: FieldConfig): FieldApi;
  subscribe(listener: (state: FormState<S>) => void): () => void;
  dispose(): void;
}

export interface FieldApi {
  path: CanonicalPath;
  get(): unknown;
  set(value: unknown): FormDispatchResult;
  validate(): ValidationIssue[];
  issues(): readonly ValidationIssue[];
  ui<T = unknown>(selector: (uiState: unknown) => T): T;
}

export interface ValidatorAdapter<S extends string = string> {
  id: string;
  supports(schema: unknown): boolean;
  validate(input: {
    data: unknown;
    uiState: unknown;
    stage: S;
    context?: SubmitContext<S>;
  }): Promise<readonly ValidationIssue<S>[]> | readonly ValidationIssue<S>[];
}

export interface ExpressionEngine {
  id: string;
  evaluate(node: ExprNode, scope: ExpressionScope): unknown;
  evaluateRule(rule: RuleDefinition, scope: ExpressionScope): readonly RuleWriteIntent[];
}

export interface Middleware<S extends string = string> {
  id: string;
  onInit?(ctx: MiddlewareInitContext<S>): void;
  beforeAction?(ctx: BeforeActionContext<S>): MiddlewareDecision | Promise<MiddlewareDecision>;
  afterAction?(ctx: AfterActionContext<S>): void;
  beforeEvaluate?(ctx: BeforeEvaluateContext<S>): void;
  afterEvaluate?(ctx: AfterEvaluateContext<S>): void;
  beforeValidate?(ctx: BeforeValidateContext<S>): void;
  afterValidate?(ctx: AfterValidateContext<S>): void;
  beforeSubmit?(ctx: BeforeSubmitContext<S>): MiddlewareDecision | Promise<MiddlewareDecision>;
  afterSubmit?(ctx: AfterSubmitContext<S>): void;
  onDispose?(): void;
}

export interface SubmitExecutionContext<S extends string = string> {
  form: FormApi<S>;
  submitContext: SubmitContext<S>;
  payload: unknown; // egress-transformed payload
  stage: S;
}

export interface SubmitResult {
  ok: boolean;
  submitId: string;
  message?: string;
  fieldIssues?: readonly ValidationIssue[];
  globalIssues?: readonly ValidationIssue[];
}
```

`useForm(...)` in `@ghost/formbar-react` MUST preserve conceptual parity with `createForm(...)` from core.

> `schema` is OPTIONAL in `@ghost/formbar-core`. Core MUST work without a schema for use cases using only function validators. The declarative schema-driven path is provided by `@ghost/formbar-from-schema`. When `schema` is omitted, metadata extraction and layout compilation are unavailable.

`form.field(path, config)` MUST be the single field entrypoint and MUST support deterministic extend+override behavior.

## 9.1) FieldConfig extend+override semantics

```ts
export interface FieldConfig {
  readonly label?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly validators?: readonly ValidatorAdapter[];
  readonly transforms?: readonly Transform[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

**Precedence (lowest to highest):**

1. Schema-derived config (from `@ghost/formbar-from-schema` metadata extraction)
2. Form-level field defaults (from `CreateFormOptions`)
3. Call-site config (the `config` argument to `form.field(path, config)`)

**Merge rules (deterministic):**

- `undefined` properties: treated as absent, do not override lower-precedence values
- `null`: explicit clear — removes the lower-precedence value
- Scalars (`string`, `number`, `boolean`): replace (highest precedence wins)
- Objects (`metadata`): deep merge per section 7.1 rules
- Arrays (`validators`, `transforms`): replace wholesale (no concat) per section 7.1 rules

**`form.field()` behavior:**

- Calling `form.field(path)` with no config returns `FieldApi` using schema-derived + form-level defaults.
- Calling `form.field(path, config)` returns `FieldApi` with call-site overrides applied on top.
- The same path with different configs MUST produce distinct `FieldApi` instances (no cross-contamination).
- Repeated calls to `form.field(path, config)` with identical config SHOULD return cached `FieldApi`.

## 10) Transform Model

Required transform phases:

- ingress (`external -> canonical state`)
- field (`editor value -> canonical field value`)
- egress (`canonical state -> submit payload`)

`date` and `date-time` MUST be canonical strings in state. UI-specific values (e.g. `Date`) MUST be mapped via transforms.

## 11) Extensibility, Capability Negotiation, and Runtime Constraints

## 11.1 Extension points (classified)

| Extension point | Owner | Stability | Capability key | Version rule |
|---|---|---|---|---|
| Expression engine | `@ghost/predicate` + core | Stable | `expr-engine.v1` | major must match |
| Operator registry | `@ghost/predicate` | Stable | `operators.v1` | major must match |
| Path resolver | core | Stable | `path-resolver.v1` | major must match |
| Validator adapters | from-schema | Stable | `validator-adapter.v1` | major must match |
| Transforms | core | Stable | `transform.v1` | major must match |
| Middleware hooks | core | Stable | `middleware.v1` | major must match |
| Layout nodes | from-schema + consumer | Experimental | `layout-node.exp.v1` | exact version required |
| Renderer plugins | react | Experimental | `renderer.exp.v1` | exact version required |

Extensions MUST declare:

```ts
interface ExtensionManifest {
  id: string;
  apiVersion: string; // semver
  capabilities: readonly string[];
}
```

Runtime MUST reject unsupported capability/version combos with deterministic error `FORMBAR_EXTENSION_INCOMPATIBLE`.

## 11.2 Runtime constraints

- Determinism: same inputs MUST produce same outputs.
- Side effects: forbidden in expression operators/transforms; allowed only in `onSubmit` and explicitly documented middleware hooks.
- Async policy:
  - expression evaluation and transforms MUST be synchronous
  - validators and submit hooks MAY be async
- Timeout budgets (default):
  - validator adapter: 500ms per adapter per run
  - middleware async hook: 250ms per hook
  - submit handler: 30s

Timeout exceed MUST fail deterministically with typed timeout errors and rollback where applicable.

## 12) Accessibility and Performance Contracts

`@ghost/formbar-react` MUST ensure semantic label association, `aria-invalid` + `aria-describedby` wiring, keyboard navigability, and focus management on submit/approve errors.

Runtime SHOULD cache path normalization by input string, precompile dependency graph, and limit re-evaluation to affected dependencies.

## 13) Layout Model

### 13.1 Abstract LayoutNode tree

```ts
export type LayoutNodeType = 'group' | 'section' | 'field' | 'array' | string;

export interface LayoutNode {
  readonly type: LayoutNodeType;
  readonly id: string;
  readonly children?: readonly LayoutNode[];
  readonly path?: string; // canonical path for 'field' and 'array' types
  readonly props?: Readonly<Record<string, unknown>>;
}
```

Built-in node types:

- `group`: logical grouping of related fields with no visual chrome.
- `section`: visual section with heading, rendered as a distinct region.
- `field`: maps to a form field via `path`. Every `field` node MUST have a valid `path` property.
- `array`: maps to an array field via `path`. Every `array` node MUST have a valid `path` property and at least one child defining the item template.

Custom node types MAY be registered via the `layout-node.exp.v1` experimental capability key (section 11.1).

### 13.2 Schema annotation to layout tree compilation

- `@ghost/formbar-from-schema` MUST compile schema structure into a `LayoutNode` tree.
- Compilation SHOULD preserve schema property order.
- Nested objects MUST produce `group` nodes.
- Array schemas MUST produce `array` nodes.
- Leaf properties MUST produce `field` nodes.
- Consumer-provided layout overrides MAY replace the schema-derived tree entirely.
- Layout tree is consumed by `@ghost/formbar-react` renderer plugins.

### 13.3 Custom node types

- Custom node types registered via `layout-node.exp.v1` MUST declare a renderer.
- Unknown node types without a registered renderer MUST fail with `FORMBAR_LAYOUT_UNKNOWN_NODE_TYPE`.
- Experimental stability: exact version match required per section 11.1.

## 14) Conformance Fixture Matrix and Phase Exit Criteria

Independent implementations MUST pass this fixture matrix.

| Fixture group | Scope | Required pass criteria |
|---|---|---|
| F1 Path grammar + namespace | dot/pointer parse, `$ui/...` reject, `/ui/...` data semantics, RFC6901 decode | 100% pass, canonical outputs byte-equal |
| F2 Stage policy | generic policy, default profile, unknown stage errors, transient submit context | 100% pass, error codes exact |
| F3 Expressions/rules | AST execution, operator typing, no coercion, write conflicts, non-convergence guard | 100% pass, deterministic traces |
| F4 Validation envelope | required fields, origin metadata, ordering, dedupe | 100% pass, output order stable |
| F5 Metadata merge | precedence, deep object merge, array replace, null/undefined rules, same-level conflicts | 100% pass, conflict codes exact |
| F6 Runtime algorithm | action flow, veto/abort, transaction rollback, commit atomicity | 100% pass with trace checkpoints |
| F7 API parity | `createForm`/`useForm`, `form.field` semantics, submit contract | 100% pass on API contract tests |
| F8 Schema adapters | Standard Schema + function validators in core, JSON Schema adapter in from-schema, Zod metadata rules | 100% pass incl rejection fixtures |
| F9 Transforms | ingress/field/egress + date/date-time canonical model | 100% pass for round-trip fixtures |
| F10 Extensibility constraints | capability negotiation, stable/experimental enforcement, timeout budgets | 100% pass on compatibility matrix |
| F11 Layout model | schema-to-layout compilation, built-in node types, custom node registration, unknown node rejection | 100% pass, tree structure deterministic |

Phase exit criteria MUST map to fixture groups:

- **Phase 1 (Foundation)**: F1, F2, F6 pass
- **Phase 2 (Schema + validation)**: F4, F5, F8 pass
- **Phase 3 (Expressions + `$ui`)**: F3 and remaining F2/F6 submit-context fixtures pass
- **Phase 4 (React + extensibility)**: F7, F10, F11 pass
- **Phase 5 (Migration hardening)**: F1-F11 full green in CI on representative forms

## 15) Migration and CQRS Boundary

Migration SHOULD proceed in increments: canonical paths -> shadow validation -> expression-driven UI -> `onSubmit` cutover -> legacy retirement.

CQRS MUST remain an `onSubmit` adapter concern. Kernel MUST NOT introduce CQRS primitives.

## 16) Consequences

### Positive

- Self-contained normative contract enables independent decomposition and equivalent implementations.
- Deterministic runtime/error model improves debuggability and conformance testing.
- Explicit extension versioning reduces integration drift.

### Trade-offs

- Up-front strictness increases initial adapter and fixture effort.
- Conflict-first policies (instead of last-write-wins) require clearer authoring discipline.

## Appendix A) Required decomposition topology for execution planning

Decomposition agents MUST produce and maintain this sub-epic topology:

1. **Core path/state** (`@ghost/formbar-core`)
2. **Schema adapters** (`@ghost/formbar-from-schema`)
3. **Expressions/rules** (`@ghost/predicate` + core integration)
4. **Validation/stages** (core + adapter contracts)
5. **React adapter** (`@ghost/formbar-react`)
6. **Extensibility/middleware** (core extension surfaces)
7. **Conformance suite** (cross-package fixtures and CI gates)

Mandatory dependency edges:

- Core path/state -> Schema adapters
- Core path/state -> Expressions/rules
- Core path/state -> Validation/stages
- Expressions/rules -> Validation/stages
- Schema adapters -> Validation/stages
- Core path/state -> React adapter
- Validation/stages -> React adapter
- Core path/state -> Extensibility/middleware
- Expressions/rules -> Extensibility/middleware
- Schema adapters -> Conformance suite
- Expressions/rules -> Conformance suite
- Validation/stages -> Conformance suite
- React adapter -> Conformance suite
- Extensibility/middleware -> Conformance suite

Conformance suite MUST be terminal in the graph (no downstream implementation sub-epic may depend on it).
