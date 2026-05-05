---
"@ghost-shell/schema-core": minor
"@ghost-shell/table-from-schema": minor
"@ghost-shell/entity-table": minor
"@ghost-shell/data-table": minor
"@formbar/from-schema": major
---

Extract `@ghost-shell/schema-core` from `formbar-from-schema` with generic schema ingestion pipeline. Create `@ghost-shell/table-from-schema` for framework-agnostic schema-to-table config. Refactor `entity-table` to use the new table-from-schema pipeline. Extract card view into standalone `EntityCardList` component. Add `ResponsiveEntity` container-width-aware switcher. Breaking: `formbar-from-schema` no longer exports schema types (import from `schema-core` instead).
