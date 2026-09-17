import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const testLanes = ["test:node", "test:vitest", "test:bun"];

export function runTestSuite(spawn = spawnSync) {
  let exitCode = 0;
  for (const lane of testLanes) {
    const result = spawn("bun", ["run", lane], { stdio: "inherit", shell: false });
    if (result.error) {
      console.error(`Unable to run ${lane}: ${result.error.message}`);
      exitCode ||= 1;
      continue;
    }
    if (result.status !== 0) exitCode ||= result.status ?? 1;
  }
  return exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runTestSuite();
}
