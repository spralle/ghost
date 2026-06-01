# Migrated Packages

## @ghost-shell/arbiter → @arbitre/core

**Migrated to**: https://github.com/spralle/arbitre
**Date**: 2026-06-01
**Package**: `@arbitre/core` on npm

The arbiter rule engine has been extracted to its own standalone repository for independent versioning and publishing. All development continues at the new location.

Consumers should update their dependencies:
- Replace `@ghost-shell/arbiter` with `@arbitre/core` (peer dep: `kuery >= 2.0.0`)
- Import paths remain the same: `@arbitre/core`, `@arbitre/core/testing`, `@arbitre/core/debug`

### Packages still referencing @ghost-shell/arbiter

The following packages in this monorepo still depend on `@ghost-shell/arbiter` and will need updates:

- **packages/sentinel-arbiter** — Primary integration bridge. Known follow-up; do NOT migrate this package yet.
- **packages/formbar-core** — Uses arbiter for form rule evaluation.
- **packages/weaver-formbar-bridge** — Uses arbiter governance rules.

These packages should switch to `@arbitre/core` in a subsequent PR once compatibility is verified.
