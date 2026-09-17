import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJson, repositoryRoot, validateReleaseInventory } from "./release-inventory.mjs";
import {
  dependencyEdges,
  runtimeExportRequests,
  validatePackedDependencies,
  validatePackedLayout,
} from "./release-layout.mjs";
import { runCommand } from "./release-process.mjs";

const bun = process.env.GHOST_BUN_PATH ?? "bun";
const approvedTemp = process.env.GHOST_VERIFY_TMP ?? "/tmp/opencode";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeName(name) {
  return name.replaceAll("@", "").replaceAll("/", "-");
}

async function packOnce(packageRoot, destination) {
  await mkdir(destination, { recursive: true });
  await runCommand(bun, ["pm", "pack", "--destination", destination, "--ignore-scripts"], { cwd: packageRoot });
  const tarballs = (await readdir(destination)).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) throw new Error(`expected one tarball from ${packageRoot}, got ${tarballs.length}`);
  return join(destination, tarballs[0]);
}

async function inspectTarball(tarball, destination) {
  const listing = (await runCommand("tar", ["-tzf", tarball])).stdout.trim().split("\n").filter(Boolean);
  if (listing.some((path) => path.startsWith("/") || path.split("/").includes(".."))) {
    throw new Error(`${tarball} contains unsafe paths`);
  }
  await mkdir(destination, { recursive: true });
  await runCommand("tar", ["-xzf", tarball, "-C", destination]);
  return join(destination, "package");
}

async function buildAndPack(entry, staging) {
  const packageRoot = join(repositoryRoot, entry.path);
  await runCommand(bun, ["run", "build:dist"], { cwd: packageRoot });
  const first = await packOnce(packageRoot, join(staging, "pack-a", safeName(entry.manifest.name)));
  const second = await packOnce(packageRoot, join(staging, "pack-b", safeName(entry.manifest.name)));
  const firstHash = sha256(await readFile(first));
  const secondHash = sha256(await readFile(second));
  if (firstHash !== secondHash) throw new Error(`${entry.manifest.name} pack is not repeatable`);
  const root = await inspectTarball(first, join(staging, "inspected", safeName(entry.manifest.name)));
  const manifest = await readJson(join(root, "package.json"));
  const files = await validatePackedLayout(root, manifest);
  return {
    category: "ghost",
    name: manifest.name,
    version: manifest.version,
    tarball: first,
    sha256: firstHash,
    root,
    manifest,
    files,
  };
}

async function locateWeaverPackages(names) {
  const knownLink = await realpath(join(repositoryRoot, "node_modules", "@weaver", "config-engine"));
  const packagesRoot = resolve(knownLink, "..");
  return Promise.all(names.map(async (name) => ({ name, root: join(packagesRoot, name.split("/")[1]) })));
}

async function packWeaver(entry, staging) {
  const manifest = await readJson(join(entry.root, "package.json"));
  if (manifest.name !== entry.name) throw new Error(`trusted Weaver path mismatch for ${entry.name}`);
  const first = await packOnce(entry.root, join(staging, "pack-a", safeName(entry.name)));
  const second = await packOnce(entry.root, join(staging, "pack-b", safeName(entry.name)));
  const firstHash = sha256(await readFile(first));
  if (firstHash !== sha256(await readFile(second))) throw new Error(`${entry.name} pack is not repeatable`);
  const root = await inspectTarball(first, join(staging, "inspected", safeName(entry.name)));
  const packedManifest = await readJson(join(root, "package.json"));
  const files = await validatePackedLayout(root, packedManifest);
  return {
    category: "weaver",
    name: entry.name,
    version: packedManifest.version,
    tarball: first,
    sha256: firstHash,
    root,
    manifest: packedManifest,
    files,
  };
}

function createConsumerManifest(artifacts, consumerRoot) {
  const dependencies = Object.fromEntries(
    artifacts.map((artifact) => [
      artifact.name,
      `file:${relative(consumerRoot, artifact.tarball).replaceAll("\\", "/")}`,
    ]),
  );
  const peers = Object.fromEntries(
    artifacts
      .flatMap(({ manifest }) => Object.entries(manifest.peerDependencies ?? {}))
      .filter(([name]) => !dependencies[name]),
  );
  return {
    name: "ghost-isolated-artifact-consumer",
    private: true,
    type: "module",
    dependencies: {
      ...peers,
      ...dependencies,
      "@types/node": "22.19.13",
      "@types/react": "18.3.12",
      "@types/react-dom": "18.3.1",
      react: "18.3.1",
      "react-dom": "18.3.1",
      typescript: "5.9.3",
    },
    overrides: dependencies,
  };
}

function smokeRequests(ghostArtifacts, condition) {
  return ghostArtifacts.flatMap(({ manifest }) => runtimeExportRequests(manifest, condition));
}

async function writeConsumerFiles(consumerRoot, artifacts) {
  const ghost = artifacts.filter(({ category }) => category === "ghost");
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(createConsumerManifest(artifacts, consumerRoot), null, 2)}\n`,
  );
  const imports = smokeRequests(ghost, "import")
    .map((request) => `await import(${JSON.stringify(request)});`)
    .join("\n");
  const requires = smokeRequests(ghost, "require")
    .map((request) => `require(${JSON.stringify(request)});`)
    .join("\n");
  const typeImports = smokeRequests(ghost, "import")
    .map(
      (request, index) =>
        `import type * as P${index} from ${JSON.stringify(request)};\ntype T${index} = keyof typeof P${index};`,
    )
    .join("\n");
  await writeFile(join(consumerRoot, "esm-smoke.mjs"), `${imports}\n`);
  await writeFile(join(consumerRoot, "cjs-smoke.cjs"), `${requires}\n`);
  await writeFile(join(consumerRoot, "types-smoke.mts"), `${typeImports}\nexport {};\n`);
  await writeFile(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: false, noEmit: true, module: "NodeNext", moduleResolution: "NodeNext", target: "ESNext", lib: ["ESNext", "DOM"], jsx: "react-jsx" }, files: ["types-smoke.mts"] }, null, 2)}\n`,
  );
}

async function installAndSmoke(staging, artifacts) {
  const consumerRoot = join(staging, "consumer");
  const cache = join(staging, "bun-cache");
  const home = join(staging, "bun-home");
  await mkdir(consumerRoot, { recursive: true });
  await writeConsumerFiles(consumerRoot, artifacts);
  const env = { ...process.env, BUN_INSTALL_CACHE_DIR: cache, BUN_INSTALL: home, NODE_PATH: "" };
  await runCommand(bun, ["install", "--lockfile-only"], { cwd: consumerRoot, env });
  await runCommand(bun, ["install", "--frozen-lockfile"], { cwd: consumerRoot, env });
  await runCommand(process.execPath, ["esm-smoke.mjs"], { cwd: consumerRoot, env });
  await runCommand(process.execPath, ["cjs-smoke.cjs"], { cwd: consumerRoot, env });
  await runCommand(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"], {
    cwd: consumerRoot,
    env,
  });
  return { consumerRoot, cache, home };
}

function validateConstraints(artifacts, trustedWeaverNames) {
  const versions = new Map(artifacts.map(({ name, version }) => [name, version]));
  for (const artifact of artifacts) validatePackedDependencies(artifact.manifest, versions, trustedWeaverNames);
  const heldEdges = artifacts.flatMap(({ name: packageName, manifest }) =>
    dependencyEdges(manifest)
      .filter(({ name, spec }) => trustedWeaverNames.has(name) && /^(?:link|workspace):/.test(spec))
      .map((edge) => ({ package: packageName, ...edge })),
  );
  const dependencyCount = artifacts.reduce((sum, artifact) => sum + dependencyEdges(artifact.manifest).length, 0);
  return { dependencyCount, heldEdges };
}

export async function verifyReleaseArtifacts(options = {}) {
  const inventoryResult = await validateReleaseInventory();
  const staging = options.staging ?? (await mkdtemp(join(approvedTemp, "ghost-artifacts-")));
  const ghostArtifacts = [];
  for (const entry of inventoryResult.publishable) ghostArtifacts.push(await buildAndPack(entry, staging));
  const weaverEntries = await locateWeaverPackages(inventoryResult.inventory.externalPrerequisites.trustedArtifacts);
  const weaverArtifacts = [];
  for (const entry of weaverEntries) weaverArtifacts.push(await packWeaver(entry, staging));
  const artifacts = [...ghostArtifacts, ...weaverArtifacts];
  const trustedWeaverNames = new Set(weaverArtifacts.map(({ name }) => name));
  const constraints = validateConstraints(artifacts, trustedWeaverNames);
  const disposable = await installAndSmoke(staging, artifacts);
  const report = createReport(staging, inventoryResult, artifacts, constraints);
  const reportPath = join(staging, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await Promise.all([
    rm(join(disposable.consumerRoot, "node_modules"), { recursive: true, force: true }),
    rm(disposable.cache, { recursive: true, force: true }),
    rm(disposable.home, { recursive: true, force: true }),
  ]);
  return { report, reportPath, reportSha256: sha256(await readFile(reportPath)) };
}

function createReport(staging, inventoryResult, artifacts, constraints) {
  const ghost = artifacts.filter(({ category }) => category === "ghost");
  return {
    schemaVersion: 1,
    issue: inventoryResult.inventory.issue,
    mode: "internal",
    success: true,
    registryReady: false,
    registryHoldIssue: inventoryResult.inventory.registryHoldIssue,
    staging,
    counts: {
      ghostPackages: ghost.length,
      weaverPrerequisites: artifacts.length - ghost.length,
      tarballs: artifacts.length,
      esmImports: smokeRequests(ghost, "import").length,
      cjsRequires: smokeRequests(ghost, "require").length,
      strictTypeImports: smokeRequests(ghost, "import").length,
      dependencyEdges: constraints.dependencyCount,
      registryHeldEdges: constraints.heldEdges.length,
    },
    registryHold: { issue: inventoryResult.inventory.registryHoldIssue, blockers: constraints.heldEdges },
    artifacts: artifacts.map(({ category, name, version, tarball, sha256: hash, files }) => ({
      category,
      name,
      version,
      tarball,
      sha256: hash,
      fileCount: files.length,
    })),
  };
}

async function main() {
  const result = await verifyReleaseArtifacts();
  process.stdout.write(
    `${JSON.stringify({ reportPath: result.reportPath, reportSha256: result.reportSha256, counts: result.report.counts, registryReady: false }, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
