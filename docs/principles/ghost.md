# Ghost Project Principles

Extends the universal, TypeScript, and frontend principles with ghost-specific rules.

## Principles

- **Ghost design tokens**: Use `var(--ghost-*)` CSS custom properties for all colors. Never hardcode hex/rgb values in component code.
- **Semantic theme tokens**: Use semantic token names (e.g., `--ghost-surface`, `--ghost-text-primary`), not physical color names.
- **Bun runtime**: Use `bun` as the package manager and script runner. Do not use `npm run` or `yarn`.
- **Beads for tracking**: All task tracking goes through `bd`. Do not create markdown TODO lists or use external trackers.

## Ghost PR Checklist (extends universal + TypeScript + frontend)

- [ ] No hardcoded color values — uses `var(--ghost-*)` CSS custom properties.
- [ ] Theme tokens are semantic (`--ghost-surface`), not physical (`--blue-500`).
- [ ] `bun run lint` and `bun test` pass.
