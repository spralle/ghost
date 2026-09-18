import { lstat, readFile, realpath, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import semver from "semver";
import { repositoryRoot, validateReleaseInventory } from "./release-inventory.mjs";

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

function assertGeneratedDependencyPath(path, workspacePath, root) {
  const expectedParent = join(root, workspacePath, "node_modules");
  const offset = relative(expectedParent, path);
  if (offset.startsWith("..") || resolve(expectedParent, offset) !== path) {
    throw new Error(`refusing generated dependency path outside ${expectedParent}: ${path}`);
  }
}

function workspaceEdges(manifest, manifestsByName) {
  const edges = [];
  for (const section of dependencySections) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      const local = manifestsByName.has(name);
      if (local && !spec.startsWith("workspace:"))
        throw new Error(`${manifest.name} uses non-workspace spec ${name}@${spec}`);
      if (!local && spec.startsWith("workspace:"))
        throw new Error(`${manifest.name} references missing workspace ${name}`);
      if (local) edges.push({ name, section, spec });
    }
  }
  return edges;
}

function validateWorkspaceSpec(edge, targetManifest, ownerName) {
  const range = edge.spec.slice("workspace:".length);
  if (["*", "^", "~"].includes(range)) return;
  if (!targetManifest.version || !semver.validRange(range) || !semver.satisfies(targetManifest.version, range)) {
    throw new Error(`${ownerName} has invalid workspace spec ${edge.name}@${edge.spec}`);
  }
}

async function removeStaleCopies(entries, manifestsByName, root) {
  let removed = 0;
  for (const entry of entries) removed += await removeStaleCopiesForWorkspace(entry, manifestsByName, root);
  return removed;
}

async function removeStaleCopiesForWorkspace({ path: workspacePath, manifest }, manifestsByName, root) {
  let removed = 0;
  for (const { name } of workspaceEdges(manifest, manifestsByName)) {
    const localPath = join(root, workspacePath, "node_modules", ...name.split("/"));
    try {
      await lstat(localPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const targetPath = join(root, manifestsByName.get(name).path);
    if ((await realpath(localPath)) === (await realpath(targetPath))) continue;
    assertGeneratedDependencyPath(localPath, workspacePath, root);
    await rm(localPath, { recursive: true });
    removed++;
  }
  return removed;
}

function installedPackageCandidates(root, workspacePath, name) {
  const candidates = [];
  let current = join(root, workspacePath);
  while (true) {
    candidates.push(join(current, "node_modules", ...name.split("/")));
    if (current === root) return candidates;
    const parent = dirname(current);
    if (relative(root, parent).startsWith("..") || parent === current) return candidates;
    current = parent;
  }
}

async function findInstalledPackage(root, workspacePath, name) {
  for (const candidate of installedPackageCandidates(root, workspacePath, name)) {
    try {
      await lstat(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`${workspacePath} is missing installed workspace ${name}`);
}

async function validateInstalledPackage(root, workspacePath, ownerManifest, edge, target) {
  validateWorkspaceSpec(edge, target.manifest, ownerManifest.name);
  const installedPath = await findInstalledPackage(root, workspacePath, edge.name);
  const expectedPath = join(root, target.path);
  const [installedRoot, expectedRoot] = await Promise.all([realpath(installedPath), realpath(expectedPath)]);
  if (installedRoot !== expectedRoot) {
    throw new Error(`${workspacePath} links ${edge.name} to ${installedRoot}, expected ${expectedRoot}`);
  }
  const installedManifest = JSON.parse(await readFile(join(installedPath, "package.json"), "utf8"));
  if (installedManifest.name !== edge.name || installedManifest.version !== target.manifest.version) {
    throw new Error(`${workspacePath} installed manifest mismatch for ${edge.name}`);
  }
}

export async function validateWorkspaceLinks(entries, manifestsByName, root = repositoryRoot) {
  let checked = 0;
  for (const { path: workspacePath, manifest } of entries) {
    for (const edge of workspaceEdges(manifest, manifestsByName)) {
      await validateInstalledPackage(root, workspacePath, manifest, edge, manifestsByName.get(edge.name));
      checked++;
    }
  }
  return checked;
}

export async function checkWorkspaceLinks({ repair = false } = {}) {
  const { entries, manifestsByName } = await validateReleaseInventory();
  const removed = repair ? await removeStaleCopies(entries, manifestsByName, repositoryRoot) : 0;
  const checked = await validateWorkspaceLinks(entries, manifestsByName);
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
