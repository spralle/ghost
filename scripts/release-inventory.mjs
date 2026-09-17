import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateJsonSchema } from "./json-schema-validator.mjs";

export const repositoryRoot = resolve(import.meta.dirname, "..");
export const inventoryPath = join(import.meta.dirname, "release-surface.json");
const dependencySections = ["dependencies", "peerDependencies", "optionalDependencies"];

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadReleaseInventory() {
  const inventory = await readJson(inventoryPath);
  await validateInventorySchema(inventory);
  return inventory;
}

async function validateInventorySchema(inventory) {
  if (typeof inventory?.$schema !== "string") throw new Error("release inventory has no schema reference");
  const schemaPath = resolve(dirname(inventoryPath), inventory.$schema);
  if (relative(dirname(inventoryPath), schemaPath).startsWith(".."))
    throw new Error("release schema escapes scripts directory");
  const schema = await readJson(schemaPath);
  validateJsonSchema(inventory, schema, "releaseSurface");
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

function inventoryCategories(inventory) {
  return {
    publishablePackages: inventory.publishablePackages,
    privateNodeApps: inventory.privateNodeApps,
    compilerFixtures: inventory.compilerFixtures,
    browserApps: inventory.browserApps.map(({ path }) => path),
    plugins: inventory.plugins.map(({ path }) => path),
  };
}

function assertEqualLists(actual, expected, label) {
  const left = JSON.stringify([...actual].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) throw new Error(`${label} mismatch\nactual=${left}\nexpected=${right}`);
}

function assertCount(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} count drifted: actual=${actual} expected=${expected}`);
}

function validateCategoryPartition(inventory, workspacePaths) {
  const owners = new Map();
  for (const [category, paths] of Object.entries(inventoryCategories(inventory))) {
    for (const path of paths) {
      if (owners.has(path)) throw new Error(`${path} appears in ${owners.get(path)} and ${category}`);
      owners.set(path, category);
    }
  }
  assertEqualLists([...owners.keys()], workspacePaths, "workspace classification");
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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validatePrivateTraits(entriesByPath, paths, category, root) {
  for (const path of paths) {
    const entry = entriesByPath.get(path);
    if (entry?.manifest.private !== true) throw new Error(`${path} in ${category} must be private`);
    if (!path.startsWith("apps/")) throw new Error(`${path} in ${category} must be an app`);
    const viteConfig = await fileExists(join(root, path, "vite.config.ts"));
    if (category === "browserApps" && !viteConfig) throw new Error(`${path} browser app lacks vite.config.ts`);
    if (category === "privateNodeApps" && viteConfig)
      throw new Error(`${path} node app unexpectedly has vite.config.ts`);
    if (category === "compilerFixtures" && !(await fileExists(join(root, path, "tsconfig.json")))) {
      throw new Error(`${path} compiler fixture lacks tsconfig.json`);
    }
  }
}

async function validateCategoryTraits(inventory, entriesByPath, root) {
  await validatePrivateTraits(entriesByPath, inventory.privateNodeApps, "privateNodeApps", root);
  await validatePrivateTraits(entriesByPath, inventory.compilerFixtures, "compilerFixtures", root);
  await validatePrivateTraits(
    entriesByPath,
    inventory.browserApps.map(({ path }) => path),
    "browserApps",
    root,
  );
  for (const plugin of inventory.plugins) {
    const entry = entriesByPath.get(plugin.path);
    if (entry?.manifest.private !== true || !plugin.path.startsWith("plugins/")) {
      throw new Error(`${plugin.path} does not have private plugin traits`);
    }
    if (!(await fileExists(join(root, plugin.path, "vite.config.ts")))) {
      throw new Error(`${plugin.path} plugin lacks vite.config.ts`);
    }
  }
}

function validateExpectedCounts(inventory, result) {
  const expected = inventory.expectedCounts;
  assertCount(result.workspaces, expected.workspaces, "workspace");
  assertCount(inventory.publishablePackages.length, expected.publishablePackages, "publishable package");
  assertCount(inventory.sentinelPackages.length, expected.sentinelPackages, "Sentinel package");
  assertCount(inventory.plugins.length, expected.privatePlugins, "private plugin");
  assertCount(inventory.browserApps.length, expected.privateBrowserApps, "private browser app");
  assertCount(inventory.privateNodeApps.length, expected.privateNodeApps, "private Node app");
  assertCount(inventory.compilerFixtures.length, expected.compilerFixtures, "compiler fixture");
  assertCount(result.exports, expected.packageExportEntries, "package export entry");
  assertCount(result.exposes, expected.pluginExposes, "plugin expose");
}

function validateSentinelPackages(inventory, entriesByPath) {
  for (const path of inventory.sentinelPackages) {
    if (!inventory.publishablePackages.includes(path)) throw new Error(`${path} Sentinel package is not publishable`);
    const entry = entriesByPath.get(path);
    const name = entry?.manifest.name;
    const sentinelName = name?.startsWith("@ghost/sentinel") || name?.startsWith("@ghost-shell/sentinel");
    if (!path.startsWith("packages/sentinel") || !sentinelName) {
      throw new Error(`${path} does not have Sentinel package traits`);
    }
  }
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

export async function validateReleaseInventory(root = repositoryRoot, suppliedInventory) {
  const inventory = suppliedInventory ?? (await loadReleaseInventory());
  if (suppliedInventory) await validateInventorySchema(inventory);
  const workspacePaths = await discoverWorkspacePaths(root);
  validateCategoryPartition(inventory, workspacePaths);
  const entries = await Promise.all(
    workspacePaths.map(async (path) => ({ path, manifest: await readJson(join(root, path, "package.json")) })),
  );
  const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const manifestsByName = new Map(entries.map((entry) => [entry.manifest.name, entry]));
  if (manifestsByName.size !== entries.length) throw new Error("workspace package names are not unique");
  const actualPublishable = entries.filter(({ manifest }) => manifest.private !== true).map(({ path }) => path);
  assertEqualLists(actualPublishable, inventory.publishablePackages, "non-private publishable workspaces");
  const publishable = inventory.publishablePackages.map((path) => entriesByPath.get(path));
  if (publishable.some((entry) => !entry)) throw new Error("publishable path has no workspace manifest");
  for (const entry of publishable) validatePublishable(entry, manifestsByName);
  await validateCategoryTraits(inventory, entriesByPath, root);
  validateSentinelPackages(inventory, entriesByPath);
  const exportCount = publishable.reduce((sum, { manifest }) => sum + javascriptExportEntries(manifest).length, 0);
  const exposeCount = await validatePlugins(inventory, root);
  validateExpectedCounts(inventory, { workspaces: entries.length, exports: exportCount, exposes: exposeCount });
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
  if (!path.startsWith("packages/")) throw new Error(`${path} publishable workspace must be a package`);
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
