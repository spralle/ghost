---
"@ghost-shell/schema-core": minor
---

Make schema extension extraction generic: any `x-*` JSON Schema key with an object value is now extracted to `metadata.extensions.<name>` instead of only `x-formbar`. Removes `widget`, `label`, `placeholder`, `options`, `extra`, and index signature from `SchemaFieldMetadata` in favor of the new `extensions` field. Adds `applySchemaMiddleware()` utility for composing schema transforms.
