import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { repositoryRoot } from "./release-inventory.mjs";

const workflowPath = join(repositoryRoot, ".github", "workflows", "verify.yml");
const source = await readFile(workflowPath, "utf8");
const workflow = parse(source);
const job = workflow.jobs?.verify;
if (!job) throw new Error("verify workflow has no verify job");
if (workflow.permissions?.contents !== "read") throw new Error("workflow permissions must be read-only");
const runSteps = job.steps.flatMap((step) => (step.run ? [step.run] : []));
if (!runSteps.includes("bun run verify:registry-consumer")) throw new Error("workflow must enforce registry preflight");
if (!runSteps.includes("bun install --frozen-lockfile")) throw new Error("workflow must use a frozen install");
if (!runSteps.includes("bun run verify:ci")) throw new Error("workflow must invoke verify:ci");
if (!source.includes("node-version: 24.11.1") || !source.includes("bun-version: 1.2.21")) {
  throw new Error("workflow runtime versions drifted");
}
process.stdout.write("CI workflow contract valid\n");
