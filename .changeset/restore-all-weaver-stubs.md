---
"@ghost-shell/shell": patch
"@ghost-shell/config-plugin-runtime": patch
---

Restore real @weaver/* package imports across shell and config-plugin-runtime, replacing no-op stubs with functional implementations from @weaver/config-engine, config-types, config-providers, and config-sessions.
