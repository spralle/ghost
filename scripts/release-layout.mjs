import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import semver from "semver";

const dependencySections = ["dependencies", "peerDependencies", "optionalDependencies"];
const localSpec = /^(?:workspace|link|file):|^(?:git|git\+|https?:)/;

export function exportTargets(exportsMap) {
  const targets = [];
  collectExportTargets(exportsMap, ".", targets);
  return targets;
}

function collectExportTargets(value, key, targets) {
  if (typeof value === "string") {
    targets.push({ key, condition: "default", target: value });
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === "./*") continue;
    collectExportTargets(child, childKey.startsWith(".") ? childKey : key, targets);
  }
}

export function runtimeExportRequests(manifest, condition) {
  return Object.entries(manifest.exports ?? {})
    .filter(([key, value]) => key !== "./*" && value !== null)
    .filter(([, value]) => typeof value !== "string" || !value.endsWith(".css"))
    .filter(([, value]) => typeof value === "string" || value[condition])
    .map(([key]) => (key === "." ? manifest.name : `${manifest.name}${key.slice(1)}`));
}

export function dependencyEdges(manifest) {
  return dependencySections.flatMap((section) =>
    Object.entries(manifest[section] ?? {}).map(([name, spec]) => ({ section, name, spec })),
  );
}

export function validatePackedDependencies(manifest, versions, trustedLocalNames = new Set()) {
  for (const edge of dependencyEdges(manifest)) {
    if (localSpec.test(edge.spec)) {
      if (!trustedLocalNames.has(edge.name)) throw new Error(`${manifest.name} leaks ${edge.name}@${edge.spec}`);
      continue;
    }
    const version = versions.get(edge.name);
    if (version && !semver.satisfies(version, edge.spec, { includePrerelease: true })) {
      throw new Error(`${manifest.name} requires ${edge.name}@${edge.spec}, supplied ${version}`);
    }
  }
}

export async function validatePackedLayout(packageRoot, manifest) {
  const targets = new Set([manifest.main, manifest.module, manifest.types]);
  for (const { target } of exportTargets(manifest.exports)) targets.add(target);
  for (const target of targets) {
    if (!target) continue;
    if (target.includes("/src/") || target.startsWith("./src"))
      throw new Error(`${manifest.name} exports source ${target}`);
    const targetPath = join(packageRoot, target.replace(/^\.\//, ""));
    if (!(await isFile(targetPath))) throw new Error(`${manifest.name} target missing: ${target}`);
  }
  const files = await walkFiles(packageRoot);
  if (files.some((path) => path.startsWith("src/") || (/\.(?:ts|tsx)$/.test(path) && !path.endsWith(".d.ts")))) {
    throw new Error(`${manifest.name} packed source files`);
  }
  await validateNoPrivateImports(packageRoot, files, manifest.name);
  return files;
}

async function validateNoPrivateImports(root, files, packageName) {
  const textFiles = files.filter((path) => /\.(?:js|cjs|mjs|d\.ts|d\.cts|json)$/.test(path));
  for (const path of textFiles) {
    const source = await readFile(join(root, path), "utf8");
    if (/@(?:ghost|ghost-shell)\/[^"'\s]+\/(?:src|dist)\//.test(source)) {
      throw new Error(`${packageName} contains private deep import in ${path}`);
    }
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`packed artifact contains symlink: ${relative(root, path)}`);
    if (entry.isDirectory()) files.push(...(await walkFiles(root, path)));
    else files.push(relative(root, path).replaceAll("\\", "/"));
  }
  return files.sort();
}
