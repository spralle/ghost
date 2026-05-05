# @ghost-shell/formr-core

<!-- [![npm version](https://img.shields.io/npm/v/@ghost-shell/formr-core)](https://www.npmjs.com/package/@ghost-shell/formr-core) -->

Framework-agnostic transactional form state engine.

## Features

- **18-step validation pipeline** — deterministic field and form-level validation with deduplication and sorting
- **Transactional state** — snapshot/rollback via `Transaction` with pluggable state strategies
- **Typed generics** — `FormApi<TData, TUi>` and `FieldApi<TData, TUi, Path>` with deep path inference
- **Arbiter rule engine integration** — wire production rules to form state via adapters
- **Middleware system** — veto/notify hooks with async support and timeout constraints
- **Standard Schema support** — auto-detects Zod, Valibot, or any Standard Schema-compatible validator

## Install

```bash
bun add @ghost-shell/formr-core
# or
npm install @ghost-shell/formr-core
```

## Quick Start

```typescript
import { createForm } from "@ghost-shell/formr-core";

interface LoginData {
  email: string;
  password: string;
}

const form = createForm<LoginData, {}>({
  initialData: { email: "", password: "" },
  validators: [(input) => (input.value === "" ? [{ path: input.path, message: "Required" }] : [])],
});

const emailField = form.field("email");
emailField.set("user@example.com");

const result = await form.submit({ onSubmit: async (ctx) => ({ ok: true }) });
```

## API Overview

| Export | Description |
|--------|-------------|
| `createForm<TData, TUi>` | Factory — creates a `FormApi` instance with full pipeline |
| `FormApi` | Core form interface: `getState`, `field`, `fieldDynamic`, `dispatch`, `submit`, `subscribe`, `dispose` |
| `FieldApi` | Per-field interface: `get`, `set`, `issues`, `touched`, `markTouched` |
| `executePipeline` | Run the 18-step validation/action pipeline directly |
| `createFieldApi` | Low-level field API constructor |
| `createArbiterAdapter` | Wire arbiter rule sessions to form state |
| `createStandardSchemaValidator` | Wrap any Standard Schema object as a `ValidatorFn` |
| `Transaction` | Snapshot/rollback transactional state wrapper |
| `FormStore` | Reactive state container with listener support |
| `createAsyncValidationManager` | Debounced async validation with cancellation |
| `runTransforms` | Execute ingress/egress field transforms |

## Related Packages

- [`@ghost-shell/formr-react`](https://www.npmjs.com/package/@ghost-shell/formr-react) — React hooks and renderers
- [`@ghost-shell/formr-from-schema`](https://www.npmjs.com/package/@ghost-shell/formr-from-schema) — Schema-to-form generation

## License

MIT
