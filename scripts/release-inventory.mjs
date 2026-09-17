import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const repositoryRoot = resolve(import.meta.dirname, "..");
export const inventoryPath = join(import.meta.dirname, "release-surface.json");
const dependencySections = ["dependencies", "peerDependencies", "optionalDependencies"];

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadReleaseInventory() {
  return readJson(inventoryPath);
}

async function discoverWorkspacePaths(root = repositoryRoot) {
  const paths = [];
  for (const group of ["apps", "packages", "plugins"]) {
    const entries = await readdir(join(root, group), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) paths.push(`${group}/${entry.name}`);
    }
  }
  return paths.sort();
}

function inventoryWorkspacePaths(inventory) {
  return [
    ...inventory.publishablePackages,
    ...inventory.privateNodeApps,
    ...inventory.compilerFixtures,
    ...inventory.browserApps.map(({ path }) => path),
    ...inventory.plugins.map(({ path }) => path),
  ].sort();
}

function assertEqualLists(actual, expected, label) {
  const left = JSON.stringify([...actual].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) throw new Error(`${label} mismatch\nactual=${left}\nexpected=${right}`);
}

function localDependencies(manifest, manifestsByName) {
  const names = new Set();
  for (const section of dependencySections) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (manifestsByName.has(name)) names.add(name);
    }
  }
  return [...names].sort();
}

function javascriptExportEntries(manifest) {
  if (!manifest.exports) return [];
  return Object.entries(manifest.exports)
    .filter(([key, target]) => key !== "./*" && target !== null)
    .filter(([, target]) => typeof target !== "string" || !target.endsWith(".css"));
}

function parsePluginConfig(source) {
  const remote = source.match(/\bname:\s*["']([^"']+)["']/)?.[1];
  const exposesBlock = source.match(/\bexposes:\s*\{([\s\S]*?)\n\s*\},\n\s*shared:/)?.[1] ?? "";
  const exposes = [...exposesBlock.matchAll(/["'](\.\/[^"']+)["']\s*:/g)].map((match) => match[1]);
  return { remote, exposes: exposes.sort() };
}

async function validatePlugins(inventory, root) {
  let exposeCount = 0;
  for (const plugin of inventory.plugins) {
    const source = await readFile(join(root, plugin.path, "vite.config.ts"), "utf8");
    const actual = parsePluginConfig(source);
    if (actual.remote !== plugin.remote) throw new Error(`${plugin.path} remote name drifted`);
    assertEqualLists(actual.exposes, plugin.exposes, `${plugin.path} exposes`);
    exposeCount += actual.exposes.length;
  }
  if (exposeCount !== inventory.expectedCounts.pluginExposes) throw new Error("plugin expose count drifted");
  return exposeCount;
}

function topologicalPackages(packages, manifestsByName) {
  const pending = new Map(packages.map((entry) => [entry.manifest.name, entry]));
  const ordered = [];
  while (pending.size > 0) {
    const ready = [...pending.values()].filter(({ manifest }) =>
      localDependencies(manifest, manifestsByName).every((name) => !pending.has(name)),
    );
    if (ready.length === 0) throw new Error(`publishable dependency cycle: ${[...pending.keys()].join(", ")}`);
    for (const entry of ready.sort((a, b) => a.path.localeCompare(b.path))) {
      pending.delete(entry.manifest.name);
      ordered.push(entry);
    }
  }
  return ordered;
}

export async function validateReleaseInventory(root = repositoryRoot) {
  const inventory = await loadReleaseInventory();
  const workspacePaths = await discoverWorkspacePaths(root);
  assertEqualLists(workspacePaths, inventoryWorkspacePaths(inventory), "workspace classification");
  if (workspacePaths.length !== inventory.expectedCounts.workspaces) throw new Error("workspace count drifted");
  const entries = await Promise.all(
    workspacePaths.map(async (path) => ({ path, manifest: await readJson(join(root, path, "package.json")) })),
  );
  const manifestsByName = new Map(entries.map((entry) => [entry.manifest.name, entry]));
  const publishable = inventory.publishablePackages.map((path) => entries.find((entry) => entry.path === path));
  if (publishable.some((entry) => !entry)) throw new Error("publishable path has no workspace manifest");
  for (const entry of publishable) validatePublishable(entry, manifestsByName);
  const exportCount = publishable.reduce((sum, { manifest }) => sum + javascriptExportEntries(manifest).length, 0);
  if (exportCount !== inventory.expectedCounts.packageExportEntries) throw new Error("package export count drifted");
  const exposeCount = await validatePlugins(inventory, root);
  return {
    inventory,
    entries,
    manifestsByName,
    publishable: topologicalPackages(publishable, manifestsByName),
    exportCount,
    exposeCount,
  };
}

function validatePublishable({ path, manifest }, manifestsByName) {
  if (manifest.private === true) throw new Error(`${manifest.name} is classified publishable but private`);
  if (!manifest.scripts?.["build:dist"]) throw new Error(`${manifest.name} has no build:dist script`);
  if (!manifest.files?.includes("dist")) throw new Error(`${manifest.name} does not pack dist`);
  for (const name of localDependencies(manifest, manifestsByName)) {
    const dependency = manifestsByName.get(name);
    if (dependency.manifest.private === true) throw new Error(`${path} depends on private ${name}`);
  }
}

export function inventoryDigest(inventory) {
  return createHash("sha256")
    .update(`${JSON.stringify(inventory)}\n`)
    .digest("hex");
}

async function main() {
  const result = await validateReleaseInventory();
  const report = {
    schemaVersion: 1,
    inventorySha256: inventoryDigest(result.inventory),
    workspaceCount: result.entries.length,
    publishablePackageCount: result.publishable.length,
    packageExportCount: result.exportCount,
    pluginCount: result.inventory.plugins.length,
    pluginExposeCount: result.exposeCount,
    registryReady: false,
    registryHoldIssue: result.inventory.registryHoldIssue,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
