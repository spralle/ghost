---
"@ghost-shell/table-from-schema": patch
"@ghost-shell/entity-table": patch
"@ghost-shell/weaver-formbar-bridge": patch
"@ghost-shell/ui": patch
---

Replace Ghost's local schema-core workspace with the published `@scheman/core` package and preserve table annotation compatibility for `metadata.extensions.table` and legacy `metadata.extra.table`.
