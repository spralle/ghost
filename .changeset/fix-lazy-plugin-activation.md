---
"@armada/plugin-contracts": patch
"@armada/shell": patch
---

Plugins are now lazy by default at startup. Only plugins declaring `activationEvents: ["onStartup"]` in their descriptor activate eagerly. All others remain dormant until triggered on-demand.
