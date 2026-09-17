import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot, validateReleaseInventory } from "./release-inventory.mjs";
import { runCommand } from "./release-process.mjs";

const require = createRequire(import.meta.url);
const approvedTemp = process.env.GHOST_VERIFY_TMP ?? "/tmp/opencode";

function resolveViteBin() {
  return join(require.resolve("vite/package.json"), "..", "bin", "vite.js");
}

async function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(root, path)));
    else files.push(path);
  }
  return files.sort();
}

export async function removeBrowserOutputs(inventory, root = repositoryRoot) {
  const paths = [...inventory.plugins, ...inventory.browserApps].map(({ path }) => join(root, path, "dist"));
  await Promise.all(paths.map((path) => rm(path, { recursive: true, force: true })));
  for (const path of paths) {
    try {
      await stat(path);
      throw new Error(`stale output survived cleanup: ${path}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

async function buildApps(inventory) {
  const viteBin = resolveViteBin();
  for (const app of inventory.browserApps) {
    await runCommand(process.execPath, [viteBin, "build"], { cwd: join(repositoryRoot, app.path) });
  }
}

function validateExposes(plugin, manifestSource) {
  for (const exposed of plugin.exposes) {
    const name = exposed.slice(2);
    if (!manifestSource.includes(name)) throw new Error(`${plugin.path} manifest omits ${exposed}`);
  }
}

async function inspectPlugin(plugin) {
  const dist = join(repositoryRoot, plugin.path, "dist");
  const files = await walkFiles(dist);
  const manifestPath = files.find((path) => basename(path) === "mf-manifest.json");
  const remoteEntry = files.find((path) => basename(path) === "remoteEntry.js");
  if (!manifestPath || !remoteEntry) throw new Error(`${plugin.path} lacks federation manifest or remote entry`);
  const manifestSource = await readFile(manifestPath, "utf8");
  JSON.parse(manifestSource);
  validateExposes(plugin, manifestSource);
  return {
    path: plugin.path,
    assetCount: files.length,
    exposes: plugin.exposes.length,
    digest: await digestFiles(files),
  };
}

async function inspectApp(app) {
  const dist = join(repositoryRoot, app.path, app.output);
  const files = await walkFiles(dist);
  if (!files.some((path) => basename(path) === app.entry)) throw new Error(`${app.path} lacks ${app.entry}`);
  if (!files.some((path) => /\.(?:js|css)$/.test(path))) throw new Error(`${app.path} emitted no browser assets`);
  return { path: app.path, assetCount: files.length, digest: await digestFiles(files) };
}

async function digestFiles(files) {
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(path.slice(repositoryRoot.length));
    hash.update(await readFile(path));
  }
  return hash.digest("hex");
}

export async function verifyBrowserBuilds(options = {}) {
  const { inventory } = await validateReleaseInventory();
  await removeBrowserOutputs(inventory);
  await runCommand(process.execPath, ["scripts/build-plugins.mjs", "--force"], { cwd: repositoryRoot, capture: false });
  await buildApps(inventory);
  const plugins = [];
  for (const plugin of inventory.plugins) plugins.push(await inspectPlugin(plugin));
  const apps = [];
  for (const app of inventory.browserApps) apps.push(await inspectApp(app));
  const reportRoot = options.reportRoot ?? (await mkdtemp(join(approvedTemp, "ghost-browser-")));
  const report = createReport(inventory, plugins, apps);
  const reportPath = join(reportRoot, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const reportSha256 = createHash("sha256")
    .update(await readFile(reportPath))
    .digest("hex");
  return { report, reportPath, reportSha256 };
}

function createReport(inventory, plugins, apps) {
  return {
    schemaVersion: 1,
    issue: inventory.issue,
    success: true,
    registryReady: false,
    counts: {
      plugins: plugins.length,
      apps: apps.length,
      exposes: plugins.reduce((sum, plugin) => sum + plugin.exposes, 0),
      pluginAssets: plugins.reduce((sum, plugin) => sum + plugin.assetCount, 0),
      appAssets: apps.reduce((sum, app) => sum + app.assetCount, 0),
    },
    plugins,
    apps,
  };
}

async function main() {
  const result = await verifyBrowserBuilds();
  process.stdout.write(
    `${JSON.stringify({ reportPath: result.reportPath, reportSha256: result.reportSha256, counts: result.report.counts }, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
