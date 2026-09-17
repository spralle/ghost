# Verification commands

Use Bun as the package and script runner. The repository currently pins Bun 1.2.21 in `package.json`.

## Test ownership

The root suite has three explicit lanes:

- `bun run test:node` checks the build prerequisite, then runs `.mjs` suites that import `node:test` with Node.
- `bun run test:vitest` starts the installed Vitest CLI with Node and runs TypeScript and TSX suites that import `vitest`.
- `bun run test:bun` runs the explicit native-Bun manifest with `bun test`.

`bun run test` runs all three lanes in that order. It attempts every lane and exits nonzero if any child fails. The shared selector rejects empty patterns, duplicate ownership, unselected tests, incompatible runner imports, and generated `dist-test` selections before a lane starts.

Do not replace these commands with bare `bun test`: bare discovery mixes incompatible Node, Vitest, and Bun APIs.

## Other gates

- `bun run build` builds the TypeScript project-reference graph.
- `bun run typecheck` forces the same reference-aware TypeScript graph check.
- `bun run lint` runs Biome and repository policy checks before the reference-aware typecheck.
- `node --test scripts/test/verification-entrypoints.test.mjs` runs the focused runner-infrastructure regressions.

The Vitest config retains a default export because Vitest requires that framework entrypoint shape. This is the only runner-foundation exception to the named-export default.
