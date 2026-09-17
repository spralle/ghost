import { lstat, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot, validateReleaseInventory } from "./release-inventory.mjs";

function assertGeneratedDependencyPath(path, workspacePath) {
  const expectedParent = join(repositoryRoot, workspacePath, "node_modules");
  const offset = relative(expectedParent, path);
  if (offset.startsWith("..") || resolve(expectedParent, offset) !== path) {
    throw new Error(`refusing generated dependency path outside ${expectedParent}: ${path}`);
  }
}

async function removeStaleCopies(entries, manifestsByName) {
  let removed = 0;
  for (const entry of entries) removed += await removeStaleCopiesForWorkspace(entry, manifestsByName);
  return removed;
}

async function removeStaleCopiesForWorkspace({ path: workspacePath, manifest }, manifestsByName) {
  let removed = 0;
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (!spec.startsWith("workspace:") || !manifestsByName.has(name)) continue;
    const localPath = join(repositoryRoot, workspacePath, "node_modules", ...name.split("/"));
    try {
      await lstat(localPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const targetPath = join(repositoryRoot, manifestsByName.get(name).path);
    if ((await realpath(localPath)) === (await realpath(targetPath))) continue;
    assertGeneratedDependencyPath(localPath, workspacePath);
    await rm(localPath, { recursive: true });
    removed++;
  }
  return removed;
}

async function validateResolution(entries, manifestsByName) {
  let checked = 0;
  for (const { path: workspacePath, manifest } of entries) {
    const require = createRequire(join(repositoryRoot, workspacePath, "package.json"));
    for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
      if (!spec.startsWith("workspace:") || !manifestsByName.has(name)) continue;
      const resolved = await realpath(require.resolve(name));
      const target = await realpath(join(repositoryRoot, manifestsByName.get(name).path));
      const offset = relative(target, resolved);
      if (offset.startsWith(".."))
        throw new Error(`${workspacePath} resolves ${name} outside its workspace: ${resolved}`);
      checked++;
    }
  }
  return checked;
}

export async function checkWorkspaceLinks({ repair = false } = {}) {
  const { entries, manifestsByName } = await validateReleaseInventory();
  const removed = repair ? await removeStaleCopies(entries, manifestsByName) : 0;
  const checked = await validateResolution(entries, manifestsByName);
  return { checked, removed };
}

async function main() {
  const result = await checkWorkspaceLinks({ repair: process.argv.includes("--repair") });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
