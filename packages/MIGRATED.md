# Migrated Packages

## @ghost-shell/arbiter → @arbitre/core

**Migrated to**: https://github.com/spralle/arbitre
**Date**: 2026-06-01
**Package**: `@arbitre/core` on npm

The arbiter rule engine has been extracted to its own standalone repository for independent versioning and publishing. All development continues at the new location.

Consumers should update their dependencies:
- Replace `@ghost-shell/arbiter` with `@arbitre/core` (peer dep: `kuery >= 2.0.0`)
- Import paths remain the same: `@arbitre/core`, `@arbitre/core/testing`, `@arbitre/core/debug`

### In-repo migration status

As of `armada-vp0x.1`, in-repo consumers that still need the rule engine depend on `@arbitre/core`:

- **packages/sentinel-arbiter** — Primary integration bridge.
- **packages/weaver-formbar-bridge** — Uses arbiter governance rules.

## @formbar/* workspaces → published @formbar packages

**Migrated to**: https://github.com/spralle/formbar
**Date**: 2026-09-03
**Package**: `@formbar/core`, `@formbar/react`, `@formbar/from-schema`, `@formbar/react-schema`, and `@formbar/arbiter` on npm
**Issue**: `armada-g9x4`

Ghost no longer owns the Formbar workspace packages. In-repo consumers now depend on the published `@formbar/*` packages for form state, React bindings, schema ingestion/rendering, and arbiter integration.

Consumers should update their dependencies:
- Replace Ghost-local workspace dependencies on `@formbar/core`, `@formbar/react`, and `@formbar/from-schema` with npm ranges.
- Import schema-renderer APIs such as `useSchemaForm`, `renderLayoutTree`, and `RendererRegistry` from `@formbar/react-schema`.
- Use `@formbar/arbiter`'s `createArbiterPlugin({ rules })` for Arbiter-backed form behavior.

## @ghost-shell/predicate → kuery

**Migrated to**: https://github.com/surikaterna/kuery
**Date**: 2026-09-03
**Package**: `kuery` on npm
**Issue**: `armada-vp0x.2`

The predicate query compiler and evaluator has been extracted to the standalone `kuery` package for independent versioning and publishing. In-repo consumers now import query, path-safety, evaluation, and typed-query APIs from `kuery`.

Consumers should update their dependencies:
- Replace `@ghost-shell/predicate` with `kuery`.
- Replace subpath imports such as `@ghost-shell/predicate/safe-path` with the corresponding `kuery` export or `kuery/safe-path`.
