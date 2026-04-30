---
"@ghost-shell/shell": patch
---

Fix lazy plugin activation bypass: primeEnabledPluginActivations now respects activationEvents, and backend discovery passes activationEvents from package.json through the tenant manifest descriptor.
