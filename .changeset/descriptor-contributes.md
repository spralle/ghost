---
"@ghost-shell/shell": minor
"@ghost-shell/plugin-contracts": minor
---

Pass plugin contributes (actions, keybindings, menus) through the descriptor
pipeline from package.json to the shell. Enables lazy keybinding discovery:
key chords from unloaded plugins work without fetching their JS bundles.
