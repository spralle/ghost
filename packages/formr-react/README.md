# @ghost-shell/formr-react

<!-- [![npm version](https://img.shields.io/npm/v/@ghost-shell/formr-react)](https://www.npmjs.com/package/@ghost-shell/formr-react) -->

React bindings for `@ghost-shell/formr-core` — hooks, renderers, and accessibility wiring.

## Features

- **`useForm`** — creates and manages a `FormApi` with React lifecycle (auto-dispose, StrictMode-safe)
- **`useField`** — fine-grained per-field subscriptions with minimal re-renders
- **`useFormSelector`** — derive computed values from form state with custom equality
- **`useSchemaForm`** — schema-driven forms with auto-generated layout trees
- **Accessibility built-in** — `getFieldProps`, `getLabelProps`, `getErrorProps` with ARIA wiring
- **Layout rendering** — `renderLayoutTree` + pluggable `RendererRegistry` for schema-driven UIs

## Install

```bash
bun add @ghost-shell/formr-react @ghost-shell/formr-core
# or
npm install @ghost-shell/formr-react @ghost-shell/formr-core
```

**Peer dependencies:** `react` ≥ 18, `@ghost-shell/formr-core`

## Quick Start

```tsx
import { useForm, useField } from "@ghost-shell/formr-react";

interface SignupData {
  name: string;
  email: string;
}

function SignupForm() {
  const form = useForm<SignupData, {}>({
    initialData: { name: "", email: "" },
  });

  const name = useField(form, "name");
  const email = useField(form, "email");

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.submit({ onSubmit: async () => ({ ok: true }) }); }}>
      <input value={name.get() as string} onChange={(e) => name.set(e.target.value)} />
      <input value={email.get() as string} onChange={(e) => email.set(e.target.value)} />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

## API Overview

| Export | Description |
|--------|-------------|
| `useForm<TData, TUi>` | Create a form instance bound to React lifecycle |
| `useField(form, path, config?)` | Subscribe to a single field with fine-grained updates |
| `useFormSelector(form, selector, equal?)` | Derived state with custom equality |
| `useSchemaForm(schema, options?)` | Schema-driven form with layout + validators |
| `renderLayoutTree(node, registry)` | Render a `LayoutNode` tree using registered renderers |
| `RendererRegistry` | Registry for custom node type renderers |
| `getFieldProps` / `getLabelProps` / `getErrorProps` | ARIA accessibility attribute helpers |
| `focusFirstError(issues)` | Focus the first field with a validation error |
| `resolveFieldStates` | Compute resolved visibility/disabled states |

## Related Packages

- [`@ghost-shell/formr-core`](https://www.npmjs.com/package/@ghost-shell/formr-core) — Framework-agnostic form engine
- [`@ghost-shell/formr-from-schema`](https://www.npmjs.com/package/@ghost-shell/formr-from-schema) — Schema-to-form generation

## License

MIT
