# Release readiness verification

Ghost has two deliberately separate readiness states:

- **Internal readiness** proves the checked-out source, packed Ghost packages, trusted local Weaver prerequisites, and browser builds are coherent.
- **Registry readiness** requires published, supported Weaver packages and a clean registry-only consumer. That work remains held by `armada-v82a.2`.

An internal green result must never be described as a complete external release approval.

## Release surface

`scripts/release-surface.json` is the machine-readable source of truth. It classifies all 58 workspaces: 27 publishable packages (including all eight Sentinel packages), 25 private federation plugins, three private browser apps, two private Node apps, and one compiler fixture. It also records all 69 plugin exposes, browser outputs, module formats, assets, runtimes, and the Weaver hold.

`bun run check:release-inventory` fails if a workspace is unclassified, a publishable package becomes private, public dependency closure reaches a private package, build scripts disappear, or browser remotes/exposes drift.

## Local commands

Use Node 24 and Bun 1.2.21. Install only with the lockfile:

```sh
bun install --frozen-lockfile
bun run check:release-inventory
bun run check:release-artifacts
bun run check:browser-builds
bun run verify:ci
```

`check:release-artifacts` builds all 27 packages in dependency order, creates and repeats native Bun tarballs, checks every export/main/module/types target, and installs real tarballs in an isolated consumer. The consumer runs ESM, advertised Node 24 `require`, and strict declaration checks with `skipLibCheck: false`. Source, private-deep-import, `workspace:`, and `file:` leakage fail the gate. The only accepted local specs are the enumerated Weaver `link:` edges, which are retained verbatim in the report as registry blockers rather than hidden or rewritten. Temporary consumer install/cache directories are removed after verification; its report and tarball evidence remain under the printed `/tmp/opencode/ghost-artifacts-*` path.

`check:browser-builds` deletes every selected output before building. It force-builds all 25 plugin remotes and all three browser apps, then validates federation manifests, remote entries, 69 exposes, assets, and content hashes. Therefore old `dist` directories cannot create a green result.

`verify:ci` runs an explicit ordered child-command plan and stops nonzero on the first failure. Its printed `/tmp/opencode/ghost-ci-*/ci-report.json` records each exact command, exit code, and log path. The report always includes `mode: internal`, `hosted: false`, and registry readiness. A successful internal run is valid only when `registryReady: false` and the `.2` hold are visible while links remain.

## Registry probe and hosted CI

Run the external boundary separately:

```sh
bun run verify:registry-consumer
```

The current expected result is exit code 2 with `REGISTRY_BLOCKED armada-v82a.2`. Its JSON report lists every external `link:`, `file:`, `workspace:`, Git, or URL dependency edge. Trusted local Weaver tarballs used by internal verification are content evidence, not registry provenance.

`.github/workflows/verify.yml` pins Node 24.11.1 and Bun 1.2.21 with read-only repository permissions. It intentionally runs the registry probe before install and `verify:ci`. The hosted job therefore fails actionably until `.2` is resolved; there is no conditional skip, publication step, credential persistence, or claimed hosted success.

## Report interpretation

Artifact, browser, and CI reports use JSON and print a SHA-256 after completion. Preserve the report, referenced logs, and tarball hashes for audit. Counts must match the inventory rather than merely being nonzero. `success: true` means only the report's declared mode passed. `registryReady: false` or `hosted: false` cannot be promoted to external release readiness.

## Semver decision

`.changeset/release-artifact-boundaries.md` records the approved conservative proposal from `armada-ncc5t`: ten major entries for Node 24/ESM, narrowed public typing, or root-only export boundaries; an initial minor release for router; and seven patch artifact-layout repairs. Existing package versions are intentionally unchanged. Publication and final release approval remain outside this issue.
