import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveRunnerSelections } from "./test-runner-selection.mjs";

const laneCommands = {
  node: {
    executable: "node",
    args: ["--test", "--import", "./apps/backend/test/register-ts-hooks.mjs"],
    prerequisites: [
      { executable: "bun", args: ["run", "build"] },
      { executable: "bun", args: ["run", "--cwd", "packages/ui", "build:dist"] },
    ],
  },
  vitest: {
    executable: "node",
    args: ["./node_modules/vitest/vitest.mjs", "run"],
  },
  bun: {
    executable: "bun",
    args: ["test"],
  },
};

export function runChild(executable, args, spawn = spawnSync) {
  const result = spawn(executable, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function runTestLane(lane, spawn = spawnSync, cwd = process.cwd()) {
  const command = laneCommands[lane];
  if (!command) throw new Error(`Unknown test lane: ${lane}`);
  const selections = resolveRunnerSelections(undefined, cwd);
  const files = selections[lane];
  console.log(`Selected ${files.length} ${lane} test files`);
  for (const prerequisite of command.prerequisites ?? []) {
    const status = runChild(prerequisite.executable, prerequisite.args, spawn);
    if (status !== 0) return status;
  }
  return runChild(command.executable, [...command.args, ...files], spawn);
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMainModule()) {
  try {
    process.exitCode = runTestLane(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
