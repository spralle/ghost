---
"@ghost-shell/config-plugin-runtime": patch
---

Restore real @weaver/config-engine imports replacing throwing stubs. The `IncrementalSchemaRegistryAdapter.getSchemasByOwner` return type changed from `Map<string, ConfigurationPropertySchema>` to `Map<string, ComposedSchemaEntry>` to match the actual weaver registry contract. No external consumers exist for this interface.
