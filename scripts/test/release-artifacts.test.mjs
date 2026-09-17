import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validatePackedDependencies, validatePackedLayout } from "../release-layout.mjs";
import { removeBrowserOutputs } from "../verify-browser-builds.mjs";

test("packed dependency validation rejects incompatible and local specs", () => {
  const versions = new Map([["fixture-b", "1.0.0"]]);
  assert.throws(
    () => validatePackedDependencies({ name: "fixture-a", dependencies: { "fixture-b": "^2.0.0" } }, versions),
    /supplied 1.0.0/,
  );
  assert.throws(
    () =>
      validatePackedDependencies({ name: "fixture-a", optionalDependencies: { external: "file:./x.tgz" } }, versions),
    /leaks external/,
  );
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

test("browser verification removes every selected stale output", async () => {
  const root = await mkdtemp(join("/tmp/opencode", "ghost-browser-clean-test-"));
  const outputs = ["plugins/example/dist", "apps/example/dist"];
  for (const output of outputs) {
    await mkdir(join(root, output), { recursive: true });
    await writeFile(join(root, output, "stale.js"), "stale\n");
  }
  await removeBrowserOutputs({ plugins: [{ path: "plugins/example" }], browserApps: [{ path: "apps/example" }] }, root);
  for (const output of outputs) await assert.rejects(access(join(root, output)));
});
