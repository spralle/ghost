import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectRegistryReadiness } from "./registry-consumer-probe.mjs";
import { repositoryRoot } from "./release-inventory.mjs";
import { runCommand } from "./release-process.mjs";

const approvedTemp = process.env.GHOST_VERIFY_TMP ?? "/tmp/opencode";

export const defaultCiPlan = Object.freeze([
  { name: "frozen-install", command: "bun", args: ["install", "--frozen-lockfile"] },
  { name: "inventory", command: "node", args: ["scripts/release-inventory.mjs"] },
  { name: "workspace-links", command: "bun", args: ["run", "check:workspace-links"] },
  { name: "build", command: "bun", args: ["run", "build"] },
  { name: "typecheck", command: "bun", args: ["run", "typecheck"] },
  { name: "lint", command: "bun", args: ["run", "lint"] },
  { name: "test", command: "bun", args: ["run", "test"] },
  { name: "build-dist", command: "bun", args: ["run", "build:dist"] },
  { name: "build-plugins", command: "bun", args: ["run", "build:plugins", "--", "--force"] },
  { name: "release-artifacts", command: "bun", args: ["run", "check:release-artifacts"] },
  { name: "browser-builds", command: "bun", args: ["run", "check:browser-builds"] },
]);

export async function runCiPlan(plan, options = {}) {
  if (!Array.isArray(plan) || plan.length === 0) throw new Error("CI plan must select at least one command");
  const reportRoot = options.reportRoot ?? (await mkdtemp(join(approvedTemp, "ghost-ci-")));
  const registry = options.registry ?? (await inspectRegistryReadiness());
  const stages = [];
  for (const stage of plan) {
    const logPath = join(reportRoot, `${String(stages.length + 1).padStart(2, "0")}-${stage.name}.log`);
    try {
      const result = await runCommand(stage.command, stage.args, {
        cwd: options.cwd ?? repositoryRoot,
        env: options.env,
        logPath,
      });
      stages.push({ name: stage.name, command: result.command, exitCode: 0, logPath });
    } catch (error) {
      stages.push({
        name: stage.name,
        command: error.result?.command ?? [stage.command, ...stage.args],
        exitCode: error.result?.code ?? 1,
        logPath,
      });
      const report = createReport(registry, stages, false);
      await writeReport(reportRoot, report);
      throw Object.assign(new Error(`CI stage failed: ${stage.name}`), { report, cause: error });
    }
  }
  const report = createReport(registry, stages, true);
  return { report, ...(await writeReport(reportRoot, report)) };
}

function createReport(registry, stages, success) {
  return {
    schemaVersion: 1,
    issue: "armada-v82a.17",
    mode: "internal",
    hosted: false,
    success,
    registryReady: registry.registryReady,
    registryHold: registry.registryReady ? null : { issue: registry.issue, blockerCount: registry.blockerCount },
    stages,
  };
}

async function writeReport(reportRoot, report) {
  const reportPath = join(reportRoot, "ci-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const reportSha256 = createHash("sha256")
    .update(await readFile(reportPath))
    .digest("hex");
  return { reportPath, reportSha256 };
}

async function main() {
  const result = await runCiPlan(defaultCiPlan);
  process.stdout.write(
    `${JSON.stringify({ reportPath: result.reportPath, reportSha256: result.reportSha256, success: true, registryReady: result.report.registryReady, registryHold: result.report.registryHold }, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    if (error.report) console.error(JSON.stringify({ success: false, stages: error.report.stages }, null, 2));
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
