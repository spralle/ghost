import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateWorkspaceLinks } from "../check-workspace-links.mjs";

const targetName = "@fixture/target";

function fixtureEntries() {
  const target = {
    path: "packages/target",
    manifest: {
      name: targetName,
      version: "1.0.0",
      exports: { ".": { require: "./dist/index.cjs", import: "./dist/index.js" } },
    },
  };
  const consumer = {
    path: "packages/consumer",
    manifest: { name: "@fixture/consumer", version: "1.0.0", dependencies: { [targetName]: "workspace:*" } },
  };
  return {
    entries: [consumer, target],
    manifests: new Map([
      [consumer.manifest.name, consumer],
      [targetName, target],
    ]),
  };
}

async function createFixture() {
  const root = await mkdtemp("/tmp/opencode/ghost-workspace-links-");
  const { entries, manifests } = fixtureEntries();
  for (const entry of entries) {
    const directory = join(root, entry.path);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "package.json"), `${JSON.stringify(entry.manifest)}\n`);
  }
  const installed = join(root, "node_modules", "@fixture", "target");
  await mkdir(join(root, "node_modules", "@fixture"), { recursive: true });
  await symlink(join(root, "packages", "target"), installed, "dir");
  return { root, entries, manifests, installed };
}

test("workspace links validate identity without built export artifacts or outputs", async () => {
  const fixture = await createFixture();
  await assert.rejects(access(join(fixture.root, "packages", "target", "dist")));
  assert.deepEqual(await validateWorkspaceLinks(fixture.entries, fixture.manifests, fixture.root), 1);
  await assert.rejects(access(join(fixture.root, "packages", "target", "dist")));
});

test("workspace links reject missing and wrong installed identities", async () => {
  const missing = await createFixture();
  await rm(missing.installed);
  await assert.rejects(
    validateWorkspaceLinks(missing.entries, missing.manifests, missing.root),
    /missing installed workspace/,
  );

  const wrong = await createFixture();
  await rm(wrong.installed);
  const unrelated = join(wrong.root, "packages", "unrelated");
  await mkdir(unrelated);
  await writeFile(join(unrelated, "package.json"), '{"name":"@fixture/target","version":"1.0.0"}\n');
  await symlink(unrelated, wrong.installed, "dir");
  await assert.rejects(validateWorkspaceLinks(wrong.entries, wrong.manifests, wrong.root), /links .* expected/);
});

test("workspace links reject non-workspace and invalid workspace specs", async () => {
  const nonWorkspace = await createFixture();
  nonWorkspace.entries[0].manifest.dependencies[targetName] = "file:../target";
  await assert.rejects(
    validateWorkspaceLinks(nonWorkspace.entries, nonWorkspace.manifests, nonWorkspace.root),
    /uses non-workspace spec/,
  );

  const invalidRange = await createFixture();
  invalidRange.entries[0].manifest.dependencies[targetName] = "workspace:^2.0.0";
  await assert.rejects(
    validateWorkspaceLinks(invalidRange.entries, invalidRange.manifests, invalidRange.root),
    /invalid workspace spec/,
  );
});

test("workspace links reject workspace specs without repository targets", async () => {
  const fixture = await createFixture();
  fixture.entries[0].manifest.dependencies["@fixture/missing"] = "workspace:*";
  await assert.rejects(
    validateWorkspaceLinks(fixture.entries, fixture.manifests, fixture.root),
    /references missing workspace/,
  );
});
