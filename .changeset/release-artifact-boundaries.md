---
"@ghost-shell/config-plugin-runtime": major
"@ghost-shell/data-table": major
"@ghost-shell/entity-table": major
"@ghost-shell/federation": major
"@ghost-shell/shell": major
"@ghost-shell/ui": major
"@ghost/sentinel-redemeine": major
"@ghost/sentinel-roles": major
"@ghost/sentinel-store-mongodb": major
"@ghost/sentinel-sync": major
"@ghost-shell/router": minor
"@ghost-shell/contracts": patch
"@ghost-shell/sentinel-arbiter": patch
"@ghost-shell/table-from-schema": patch
"@ghost-shell/weaver-formbar-bridge": patch
"@ghost/sentinel": patch
"@ghost/sentinel-react": patch
"@ghost/sentinel-store-memory": patch
---

Propose conservative release boundaries for the recovered package artifacts. These entries are release metadata only; publication and source version updates are not authorized.

The Node-facing packages that expose ESM through `require` now require Node 24. CommonJS consumers must use Node 24 native synchronous ESM loading or migrate to `import`. The federation loader guard now narrows unknown values to the checked loader contract rather than the complete vendor host class. Consumers must not infer untested vendor methods such as `registerRemotes` from that guard.

The four Sentinel packages gaining root-only export maps must migrate deep imports to their public roots. Router is an initial public package because it is in the public shell dependency closure; its root and `testing` entrypoints are the supported initial surface. Layout-only declaration and artifact repairs remain patch proposals. Existing changesets still participate in Changesets' highest-bump selection.
