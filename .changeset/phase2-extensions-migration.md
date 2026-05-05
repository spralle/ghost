---
"@ghost-shell/schema-core": patch
"@formbar/from-schema": patch
"@ghost-shell/ui": patch
---

Migrate all downstream consumers to read formbar-specific metadata from `metadata.extensions.formbar` instead of top-level metadata fields. Zod extractors now write formbar hints to `extensions.formbar` matching the JSON Schema extractor pattern.
