---
"@ghost/sentinel": patch
"@ghost-shell/intents": patch
"@ghost-shell/weaver-formbar-bridge": patch
"@ghost-shell/sentinel-arbiter": patch
"@ghost-shell/plugin-system": patch
---

armada-vp0x.1/armada-vp0x.2/armada-vp0x.3: replace removed internal arbiter/predicate workspace dependencies with published `@arbitre/core` and `kuery`, and drop stale predicate metadata from plugin-system.
