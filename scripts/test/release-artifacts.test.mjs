import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  inspectPackedDependencies,
  validatePackedDependencies,
  validatePackedImports,
  validatePackedLayout,
} from "../release-layout.mjs";
import { inspectPluginOutput, removeBrowserOutputs } from "../verify-browser-builds.mjs";

test("packed dependency validation rejects incompatible and local specs", () => {
  const versions = new Map([["fixture-b", "1.0.0"]]);
  assert.throws(
    () => validatePackedDependencies({ name: "fixture-a", dependencies: { "fixture-b": "^2.0.0" } }, versions),
    /supplied 1.0.0/,
  );
  assert.throws(
    () =>
      validatePackedDependencies({ name: "fixture-a", optionalDependencies: { external: "file:./x.tgz" } }, versions),
    /leaks file dependency external/,
  );
});

test("packed dependency validation rejects every non-registry spec class without trusted bypasses", () => {
  const specs = new Map([
    ["workspace", "workspace:*"],
    ["link", "link:../weaver"],
    ["file", "file:../weaver.tgz"],
    ["git", "git+ssh://git@example.test/weaver.git"],
    ["url", "https://example.test/weaver.tgz"],
    ["path", "../weaver"],
  ]);
  for (const [kind, spec] of specs) {
    assert.throws(
      () => validatePackedDependencies({ name: "fixture", dependencies: { "@weaver/example": spec } }, new Map()),
      new RegExp(`leaks ${kind} dependency`),
    );
  }
});

test("internal dependency inspection reports every explicitly held non-registry spec", () => {
  const dependencies = {
    "@weaver/workspace": "workspace:*",
    "@weaver/link": "link:../link",
    "@weaver/file": "file:../file.tgz",
    "@weaver/git": "github:example/repository",
    "@weaver/url": "https://example.test/archive.tgz",
    "@weaver/path": "../path",
  };
  const holds = new Set(Object.keys(dependencies));
  const blockers = inspectPackedDependencies({ name: "fixture", dependencies }, new Map(), holds);
  assert.deepEqual(blockers.map(({ kind }) => kind).sort(), ["file", "git", "link", "path", "url", "workspace"]);
});

test("packed layout rejects source targets", async () => {
  const root = await mkdtemp(join("/tmp/opencode", "ghost-layout-test-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "index.ts"), "export {};\n");
  await assert.rejects(
    validatePackedLayout(root, { name: "fixture", main: "./src/index.ts", files: ["src"] }),
    /exports source/,
  );
});

test("packed imports reject arbitrary undeclared Ghost package subpaths", async () => {
  const root = await mkdtemp(join("/tmp/opencode", "ghost-import-test-"));
  await writeFile(join(root, "index.js"), 'import "@ghost-shell/target/private-api";\n');
  const exportsByPackage = new Map([
    ["@ghost-shell/target", { ".": "./dist/index.js", "./public": "./dist/public.js" }],
  ]);
  await assert.rejects(
    validatePackedImports(root, ["index.js"], "@ghost-shell/fixture", exportsByPackage),
    /imports undeclared subpath/,
  );
  await writeFile(join(root, "index.js"), 'import "@ghost-shell/target/public";\n');
  await validatePackedImports(root, ["index.js"], "@ghost-shell/fixture", exportsByPackage);
});

test("browser verification removes every selected stale output", async () => {
  const root = await mkdtemp(join("/tmp/opencode", "ghost-browser-clean-test-"));
  const outputs = ["plugins/example/dist", "apps/example/dist"];
  for (const output of outputs) {
    await mkdir(join(root, output), { recursive: true });
    await writeFile(join(root, output, "stale.js"), "stale\n");
  }
  await removeBrowserOutputs(
    {
      plugins: [{ path: "plugins/example" }],
      browserApps: [{ path: "apps/example", output: "dist" }],
      browserArtifacts: { outputDirectory: "dist" },
    },
    root,
  );
  for (const output of outputs) await assert.rejects(access(join(root, output)));
});

const browserArtifacts = {
  outputDirectory: "output",
  manifest: "federation.json",
  remoteEntry: "entry.js",
  assetDirectory: "chunks",
};
const fixturePlugin = { path: "plugins/fixture", remote: "ghost.fixture", exposes: ["./pluginContract"] };

function validBrowserManifest() {
  return {
    id: "ghost.fixture",
    name: "ghost.fixture",
    metaData: {
      name: "ghost.fixture",
      remoteEntry: { name: "entry.js", path: "" },
      types: { path: "", zip: "types.zip", api: "types.d.ts" },
    },
    exposes: [
      {
        id: "ghost.fixture:pluginContract",
        name: "pluginContract",
        path: "./pluginContract",
        assets: { js: { sync: ["chunks/plugin.js"], async: [] }, css: { sync: [], async: [] } },
      },
    ],
  };
}

async function createBrowserFixture(manifest = validBrowserManifest()) {
  const root = await mkdtemp(join("/tmp/opencode", "ghost-browser-manifest-test-"));
  const output = join(root, fixturePlugin.path, browserArtifacts.outputDirectory);
  await mkdir(join(output, browserArtifacts.assetDirectory), { recursive: true });
  await Promise.all([
    writeFile(join(output, browserArtifacts.manifest), `${JSON.stringify(manifest)}\n`),
    writeFile(join(output, browserArtifacts.remoteEntry), "export {};\n"),
    writeFile(join(output, "types.zip"), "types\n"),
    writeFile(join(output, "types.d.ts"), "export {};\n"),
    writeFile(join(output, "chunks", "plugin.js"), "export {};\n"),
    writeFile(join(output, "mf-manifest.json"), `${JSON.stringify(validBrowserManifest())}\n`),
  ]);
  return { root, output };
}

test("browser manifest validation uses configured artifacts and exact semantic identities", async () => {
  const { root } = await createBrowserFixture();
  const result = await inspectPluginOutput(fixturePlugin, browserArtifacts, root);
  assert.equal(result.exposes, 1);
  assert.equal(result.referencedAssets, 2);

  const wrongIdentity = validBrowserManifest();
  wrongIdentity.name = "ghost.other";
  const fixture = await createBrowserFixture(wrongIdentity);
  await assert.rejects(inspectPluginOutput(fixturePlugin, browserArtifacts, fixture.root), /id\/name does not match/);
});

test("browser manifest validation rejects duplicate and mismatched exposes", async () => {
  const duplicate = validBrowserManifest();
  duplicate.exposes.push(structuredClone(duplicate.exposes[0]));
  const duplicateFixture = await createBrowserFixture(duplicate);
  await assert.rejects(
    inspectPluginOutput(fixturePlugin, browserArtifacts, duplicateFixture.root),
    /duplicate exposes/,
  );

  const mismatched = validBrowserManifest();
  mismatched.exposes[0].name = "wrongName";
  const mismatchFixture = await createBrowserFixture(mismatched);
  await assert.rejects(
    inspectPluginOutput(fixturePlugin, browserArtifacts, mismatchFixture.root),
    /identity does not match/,
  );
});

test("browser manifest validation rejects missing and escaping referenced assets", async () => {
  const missingFixture = await createBrowserFixture();
  await rm(join(missingFixture.output, "chunks", "plugin.js"));
  await assert.rejects(inspectPluginOutput(fixturePlugin, browserArtifacts, missingFixture.root), /missing asset/);

  const escaping = validBrowserManifest();
  escaping.exposes[0].assets.js.sync = ["chunks/../../outside.js"];
  const escapeFixture = await createBrowserFixture(escaping);
  await assert.rejects(
    inspectPluginOutput(fixturePlugin, browserArtifacts, escapeFixture.root),
    /asset escapes output/,
  );
});

test("browser manifest validation never accepts a stale hardcoded manifest name", async () => {
  const fixture = await createBrowserFixture();
  await rm(join(fixture.output, browserArtifacts.manifest));
  await assert.rejects(inspectPluginOutput(fixturePlugin, browserArtifacts, fixture.root), /ENOENT/);
});
