# @formbar/from-schema

<!-- [![npm version](https://img.shields.io/npm/v/@formbar/from-schema)](https://www.npmjs.com/package/@formbar/from-schema) -->

Schema-to-form generation — ingest Zod v4 or JSON Schema, extract field metadata, compile layout trees, and auto-wire validation.

## Features

- **Multi-schema support** — Zod v4, JSON Schema, and any Standard Schema-compatible object
- **Field metadata extraction** — types, defaults, constraints, labels from schema introspection
- **Layout compilation** — auto-generates a `LayoutNode` tree (fields, groups, sections, arrays)
- **Layout middleware** — transform the compiled tree before rendering
- **Conditional required** — resolves `if/then/else`, `oneOf`, expression-based, and dependent required
- **Pluggable extractors** — register custom `SchemaExtractor` implementations

## Install

```bash
bun add @formbar/from-schema @formbar/core
# or
npm install @formbar/from-schema @formbar/core
```

**Peer dependencies:** `@formbar/core`. Optional: `zod` (for Zod schema support).

## Quick Start

```typescript
import { createSchemaForm } from "@formbar/from-schema";
import { createForm } from "@formbar/core";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
});

const { fields, layout, validators, defaults } = createSchemaForm(schema);

const form = createForm({
  initialData: defaults,
  validators,
});
```

## API Overview

| Export | Description |
|--------|-------------|
| `createSchemaForm(schema, options?)` | Ingest schema → fields + layout + validators + defaults |
| `ingestSchema(schema)` | Low-level schema ingestion returning `SchemaIngestionResult` |
| `compileLayout(result, options?)` | Compile ingestion result into a `LayoutNode` tree |
| `applyLayoutMiddleware(node, middleware, fields)` | Transform layout tree via middleware pipeline |
| `LayoutNodeRegistry` | Register custom layout node type definitions |
| `createJsonSchemaValidator(schema)` | Create a `ValidatorFn` from a JSON Schema object |
| `extractFromZodV4` / `extractFromJsonSchema` | Schema-specific field extractors |
| `resolveAllConditionalRequired(...)` | Resolve dynamic required fields from schema conditions |

## Layout Node Types

- `FieldNode` — single form field with path, type, and metadata
- `GroupNode` — logical grouping of fields
- `SectionNode` — visual section with heading
- `ArrayNode` — repeatable field group

## Related Packages

- [`@formbar/core`](https://www.npmjs.com/package/@formbar/core) — Framework-agnostic form engine
- [`@formbar/react`](https://www.npmjs.com/package/@formbar/react) — React hooks and renderers

## License

MIT
