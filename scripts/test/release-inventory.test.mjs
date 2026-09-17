import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { inventoryDigest, repositoryRoot, validateReleaseInventory } from "../release-inventory.mjs";

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

test("release boundary changeset records approved conservative bumps", async () => {
  const source = await readFile(join(repositoryRoot, ".changeset", "release-artifact-boundaries.md"), "utf8");
  assert.equal((source.match(/: major/g) ?? []).length, 10);
  assert.equal((source.match(/: minor/g) ?? []).length, 1);
  assert.equal((source.match(/: patch/g) ?? []).length, 7);
  assert.match(source, /publication and source version updates are not authorized/i);
});
