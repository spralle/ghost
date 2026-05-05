---
"@scheman/core": patch
"@ghost-shell/formr-from-schema": patch
"@ghost-shell/ui": patch
---

Migrate all downstream consumers to read formr-specific metadata from `metadata.extensions.formr` instead of top-level metadata fields. Zod extractors now write formr hints to `extensions.formr` matching the JSON Schema extractor pattern.
