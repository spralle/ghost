import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { runChild, runTestLane } from "../run-test-lane.mjs";
import { runTestSuite, testLanes } from "../run-test-suite.mjs";
import { resolveRunnerSelections } from "../test-runner-selection.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createFixture(files) {
  const root = await mkdtemp(join(tmpdir(), "ghost-runner-"));
  temporaryDirectories.push(root);
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
  }
  return root;
}

function fixtureConfig(overrides = {}) {
  return {
    node: { patterns: ["packages/fixture/node.test.mjs"], excludedFiles: [] },
    vitest: { patterns: ["packages/fixture/vitest.test.ts"], excludedFiles: [] },
    bun: { patterns: ["packages/fixture/bun.test.ts"], excludedFiles: [] },
    ...overrides,
  };
}

const fixtureSources = {
  "packages/fixture/node.test.mjs": 'import test from "node:test";\n',
  "packages/fixture/vitest.test.ts": 'import { test } from "vitest";\n',
  "packages/fixture/bun.test.ts": 'import { test } from "bun:test";\n',
};

test("canonical runner ownership is nonempty, complete, and disjoint", () => {
  const selections = resolveRunnerSelections();
  assert.deepEqual(Object.fromEntries(Object.entries(selections).map(([lane, files]) => [lane, files.length])), {
    node: 47,
    vitest: 71,
    bun: 17,
  });
  assert.ok(selections.node.includes("apps/plugin-dev-host/test/manifest-rewrite.test.mjs"));
  assert.ok(selections.vitest.includes("packages/sentinel/src/__tests__/engine.test.ts"));
  assert.ok(selections.bun.includes("packages/sentinel-react/src/__tests__/hooks.test.tsx"));
});

test("root scripts use explicit lanes without stale generated selections", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(packageJson.scripts.test, "node ./scripts/run-test-suite.mjs");
  assert.deepEqual(testLanes, ["test:node", "test:vitest", "test:bun"]);
  const scripts = Object.values(packageJson.scripts).join("\n");
  assert.doesNotMatch(scripts, /apps\/shell\/src\/\*\.integration\.test\.mjs|dist-test/);
  assert.doesNotMatch(packageJson.scripts.test, /--silent/);
});

test("empty runner patterns are rejected", async () => {
  const root = await createFixture(fixtureSources);
  const config = fixtureConfig({ node: { patterns: ["missing/*.test.mjs"], excludedFiles: [] } });
  assert.throws(() => resolveRunnerSelections(config, root), /matched no files/);
});

test("duplicate cross-runner ownership is rejected", async () => {
  const root = await createFixture(fixtureSources);
  const config = fixtureConfig({
    bun: {
      patterns: ["packages/fixture/bun.test.ts", "packages/fixture/node.test.mjs"],
      excludedFiles: [],
    },
  });
  assert.throws(() => resolveRunnerSelections(config, root), /owned by both node and bun/);
});

test("generated dist-test selections are rejected", async () => {
  const root = await createFixture(fixtureSources);
  const config = fixtureConfig({ node: { patterns: ["dist-test/node.test.mjs"], excludedFiles: [] } });
  assert.throws(() => resolveRunnerSelections(config, root), /generated path/);
});

test("unselected tests are rejected", async () => {
  const root = await createFixture({
    ...fixtureSources,
    "packages/fixture/extra.test.mjs": 'import test from "node:test";\n',
  });
  assert.throws(() => resolveRunnerSelections(fixtureConfig(), root), /ownership mismatch.*extra\.test\.mjs/);
});

test("aggregate runner reaches every lane and propagates a child failure", () => {
  const calls = [];
  const statuses = [0, 23, 0];
  const status = runTestSuite((executable, args) => {
    calls.push([executable, ...args]);
    return { status: statuses[calls.length - 1] };
  });
  assert.equal(status, 23);
  assert.deepEqual(
    calls,
    testLanes.map((lane) => ["bun", "run", lane]),
  );
});

test("Node lane propagates its build prerequisite failure", () => {
  const calls = [];
  const status = runTestLane("node", (executable, args) => {
    calls.push([executable, ...args]);
    return { status: 31 };
  });
  assert.equal(status, 31);
  assert.deepEqual(calls, [["bun", "run", "build"]]);
});

test("child execution returns the real process status", () => {
  const status = runChild(process.execPath, ["--input-type=module", "--eval", "process.exit(19)"]);
  assert.equal(status, 19);
});
