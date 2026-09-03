# kuery

## Purpose

A standalone MongoDB-style query engine for evaluating queries against documents. Used throughout Ghost Shell for when-clause evaluation and intent matching — but has no Ghost Shell dependencies and can be used independently.

## Installation

```bash
bun add kuery
```

## Key Exports

### `Kuery<T>` Class

Compiled query with fluent API for filtering collections:

```ts
class Kuery<T = Record<string, unknown>> {
  constructor(query: TypedQuery<T> | Query, options?: KueryOptions);
  test(doc: T): boolean;
  find(collection: readonly T[]): readonly T[];
  findOne(collection: readonly T[]): T;
  skip(count: number): this;
  limit(count: number): this;
  sort(spec: Record<string, 1 | -1>): this;
}

interface KueryOptions {
  readonly registry?: OperatorRegistry;
}
```

### Compilation

```ts
type Query = Record<string, unknown>;

function compile(query: Query): ExprNode;
function compileFilter(query: Query, options?: CompileFilterOptions): FilterFn;
function compileShorthand(query: ShorthandQuery): Query;

type FilterFn<T = Record<string, unknown>> = (doc: T) => boolean;
```

### Evaluation

```ts
function evaluate(node: ExprNode, scope: EvaluationScope, options?: EvaluateOptions): unknown;

interface EvaluateOptions {
  readonly maxDepth?: number;
  readonly operators?: OperatorRegistry;
}
```

### Diagnostics

```ts
function evaluateWithTrace(
  node: ExprNode,
  scope: EvaluationScope,
): EvaluateWithTraceResult;

interface KueryFailureTrace {
  path: string;
  operator: string;
  expected: unknown;
  actual: unknown;
}
```

### Collection Helpers

```ts
function find<T>(collection: readonly T[], query: Query, options?: FindOptions): readonly T[];
function findOne<T>(collection: readonly T[], query: Query, options?: CompileFilterOptions): T | undefined;
```

### Custom Operators

```ts
interface OperatorDefinition {
  readonly name: string;
  readonly arity: number | "variadic";
  readonly minArgs?: number;
}

class OperatorRegistry {
  get(name: string): OperatorDefinition | undefined;
  has(name: string): boolean;
  register(definition: OperatorDefinition, execute?: CustomOperatorFn): void;
  getHandler(name: string): CustomOperatorFn | undefined;
}

type CustomOperatorFn = (args: readonly unknown[], scope: Record<string, unknown>) => unknown;
```

### Typed Queries

```ts
type TypedQuery<T> = { [K in DotPaths<T>]?: FieldCondition<PathValue<T, K>> };
```

Provides full dot-path autocomplete and type-safe field conditions for known document shapes.

### Path Utilities

```ts
function resolvePath(path: string, scope: Record<string, unknown>): unknown;
function validateAndSplitPath(path: string): readonly string[];
```

### Safety

```ts
function assertSafeSegment(segment: string): void;
const DANGEROUS_KEYS: ReadonlySet<string>;

class KueryError extends Error {
  readonly code: KueryErrorCode;
}
```

### Supported Operators

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$regex`, `$all`, `$size`, `$and`, `$or`, `$not`, `$nor`.

## Examples

```ts
import { Kuery, find, compile, evaluateWithTrace } from "kuery";

// Fluent API
const pred = new Kuery<User>({ age: { $gte: 18 }, role: "admin" });
const admins = pred.sort({ name: 1 }).limit(10).find(users);

// One-shot find
const results = find(documents, { status: "active", "metadata.priority": { $gte: 2 } });

// Diagnostics
const ast = compile({ score: { $gt: 90 } });
const trace = evaluateWithTrace(ast, { score: 50 });
if (!trace.result) {
  console.log("Trace entries:", trace.traces);
}

// Custom operator
import { OperatorRegistry } from "kuery";
const registry = new OperatorRegistry();
registry.register(
  { name: "$startsWith", arity: 2 },
  ([fieldValue, prefix]) =>
    typeof fieldValue === "string" &&
    typeof prefix === "string" &&
    fieldValue.startsWith(prefix),
);
const pred2 = new Kuery({ name: { $startsWith: "A" } }, { registry });
const startsWithA = pred2.test({ name: "Ada" });
```
