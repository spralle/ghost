---
"@ghost/sentinel": minor
"@ghost/sentinel-redemeine": minor
"@ghost/sentinel-store-memory": patch
"@ghost/sentinel-store-mongodb": minor
"@ghost-shell/bridge": patch
"@ghost-shell/commands": patch
"@ghost-shell/shell": patch
---

Restore stored-policy resource isolation, descriptor-safe validation, and detached condition data; preserve MongoDB policy fidelity; reject malformed keybindings; and recover shell drag-and-drop, popout, and authorization integration behavior.

Before enabling the corrected evaluator, invalidate and regenerate every pre-fix server, client, and offline permission bundle. Do not wait for TTL expiry or permit stale fallback, and require `resource.type` to be an exact scalar string.
