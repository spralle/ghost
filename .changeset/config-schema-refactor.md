---
"@ghost-shell/contracts": minor
"@ghost-shell/config-plugin-runtime": patch
"@ghost-shell/shell": patch
---

Refactor configuration contributions to use weaver's canonical ConfigurationPropertySchema directly. Remove PluginConfigurationContribution wrapper type. Configuration contributions are now full JSON Schema objects with relative keys (weaver auto-prefixes via deriveNamespace). Move theme config ownership from theme-default-plugin to the theme service builtin.
