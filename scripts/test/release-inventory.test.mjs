import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  inventoryDigest,
  loadReleaseInventory,
  repositoryRoot,
  validateReleaseInventory,
} from "../release-inventory.mjs";

function clone(value) {
  return structuredClone(value);
}

test("release inventory classifies every workspace and public closure", async () => {
  const result = await validateReleaseInventory();
  assert.equal(result.entries.length, 58);
  assert.equal(result.publishable.length, 27);
  assert.equal(result.inventory.sentinelPackages.length, 8);
  assert.equal(result.inventory.plugins.length, 25);
  assert.equal(result.exportCount, 36);
  assert.equal(result.exposeCount, 69);
  assert.match(inventoryDigest(result.inventory), /^[a-f0-9]{64}$/);
});

test("release inventory accepts only the canonical schema reference", async () => {
  const inventory = await loadReleaseInventory();
  assert.equal(inventory.$schema, "./release-surface.schema.json");
  await validateReleaseInventory(repositoryRoot, clone(inventory));
});

test("release inventory rejects public workspaces reclassified as private", async () => {
  const inventory = clone(await loadReleaseInventory());
  const [moved] = inventory.publishablePackages.splice(0, 1);
  inventory.privateNodeApps.push(moved);
  await assert.rejects(validateReleaseInventory(repositoryRoot, inventory), /non-private publishable workspaces/);
});

test("release inventory rejects expected count drift", async () => {
  const inventory = clone(await loadReleaseInventory());
  inventory.expectedCounts.privatePlugins += 1;
  await assert.rejects(validateReleaseInventory(repositoryRoot, inventory), /private plugin count drifted/);
});

test("release inventory rejects duplicate and missing category ownership", async () => {
  const duplicate = clone(await loadReleaseInventory());
  duplicate.compilerFixtures.push(duplicate.privateNodeApps[0]);
  await assert.rejects(validateReleaseInventory(repositoryRoot, duplicate), /appears in .* and compilerFixtures/);

  const missing = clone(await loadReleaseInventory());
  missing.plugins.pop();
  await assert.rejects(validateReleaseInventory(repositoryRoot, missing), /workspace classification mismatch/);
});

test("release inventory rejects category entries with the wrong runtime trait", async () => {
  const inventory = clone(await loadReleaseInventory());
  const nodePath = inventory.privateNodeApps[0];
  const browserPath = inventory.browserApps[0].path;
  inventory.privateNodeApps[0] = browserPath;
  inventory.browserApps[0].path = nodePath;
  await assert.rejects(validateReleaseInventory(repositoryRoot, inventory), /node app unexpectedly has vite.config.ts/);
});

test("release inventory rejects missing and wrong schema references", async () => {
  const missing = clone(await loadReleaseInventory());
  delete missing.$schema;
  await assert.rejects(validateReleaseInventory(repositoryRoot, missing), /\$schema must equal/);

  const wrong = clone(await loadReleaseInventory());
  wrong.$schema = "./missing-release-schema.json";
  await assert.rejects(validateReleaseInventory(repositoryRoot, wrong), /\$schema must equal/);
});

test("release inventory rejects substitution with an existing JSON document", async () => {
  const substituted = clone(await loadReleaseInventory());
  substituted.$schema = "./release-surface.json";
  substituted.runtime.bun = 42;
  await assert.rejects(validateReleaseInventory(repositoryRoot, substituted), /\$schema must equal/);
});

test("release inventory rejects escaping, URL, and absolute schema references", async () => {
  const inventory = await loadReleaseInventory();
  const references = ["../release-surface.schema.json", "https://example.test/schema.json", "/tmp/schema.json"];
  for (const reference of references) {
    const invalid = clone(inventory);
    invalid.$schema = reference;
    await assert.rejects(validateReleaseInventory(repositoryRoot, invalid), /\$schema must equal/);
  }
});

test("canonical release schema rejects malformed inventory data", async () => {
  const malformed = clone(await loadReleaseInventory());
  malformed.runtime.bun = 42;
  await assert.rejects(validateReleaseInventory(repositoryRoot, malformed), /must be string/);
});

test("release boundary changeset records approved conservative bumps", async () => {
  const source = await readFile(join(repositoryRoot, ".changeset", "release-artifact-boundaries.md"), "utf8");
  assert.equal((source.match(/: major/g) ?? []).length, 10);
  assert.equal((source.match(/: minor/g) ?? []).length, 1);
  assert.equal((source.match(/: patch/g) ?? []).length, 7);
  assert.match(source, /publication and source version updates are not authorized/i);
});
