import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runCiPlan } from "../verify-ci.mjs";

const blockedRegistry = { issue: "armada-v82a.2", registryReady: false, blockerCount: 1 };

test("CI orchestration rejects an empty selection", async () => {
  await assert.rejects(runCiPlan([], { registry: blockedRegistry }), /at least one/);
});

test("CI orchestration propagates child failure and stops", async () => {
  const reportRoot = await mkdtemp(join("/tmp/opencode", "ghost-ci-test-"));
  const marker = join(reportRoot, "must-not-run");
  const plan = [
    { name: "failure", command: process.execPath, args: ["-e", "process.exit(7)"] },
    {
      name: "after",
      command: process.execPath,
      args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`],
    },
  ];
  await assert.rejects(runCiPlan(plan, { reportRoot, registry: blockedRegistry }), /failure/);
  const report = JSON.parse(await readFile(join(reportRoot, "ci-report.json"), "utf8"));
  assert.equal(report.success, false);
  assert.equal(report.stages.length, 1);
  assert.equal(report.stages[0].exitCode, 7);
  await assert.rejects(access(marker));
});
