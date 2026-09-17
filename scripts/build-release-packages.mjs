import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot, validateReleaseInventory } from "./release-inventory.mjs";
import { runCommand } from "./release-process.mjs";

export async function buildReleasePackages() {
  const { publishable } = await validateReleaseInventory();
  for (const entry of publishable) {
    process.stdout.write(`Building ${entry.manifest.name}\n`);
    await runCommand("bun", ["run", "build:dist"], { cwd: join(repositoryRoot, entry.path), capture: false });
  }
  return publishable.length;
}

async function main() {
  const count = await buildReleasePackages();
  process.stdout.write(`Built ${count} publishable packages\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
