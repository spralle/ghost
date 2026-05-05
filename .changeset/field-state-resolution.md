---
"@formbar/react": minor
"@ghost/ui": patch
---

Add automatic field state resolution from arbiter uiState. useSchemaForm now resolves `$ui.<path>.{visible,readOnly,disabled}` into a `fieldStates` map, prunes hidden fields from the layout tree, and exposes `useFieldState` via SchemaFormProvider context. GhostFieldRenderer consumes resolved readOnly/disabled state.
