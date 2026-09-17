import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import semver from "semver";
import ts from "typescript";

const dependencySections = ["dependencies", "peerDependencies", "optionalDependencies"];

export function nonRegistrySpecKind(spec) {
  if (typeof spec !== "string") return "invalid";
  if (spec.startsWith("workspace:")) return "workspace";
  if (spec.startsWith("link:")) return "link";
  if (spec.startsWith("file:")) return "file";
  if (/^(?:git(?:\+[^:]+)?|git\+|github|gitlab|bitbucket):/iu.test(spec) || /^(?:git@|ssh:|git:\/\/)/iu.test(spec)) {
    return "git";
  }
  if (/^[a-z][a-z+.-]*:\/\//iu.test(spec)) return "url";
  if (/^(?:\.{0,2}\/|~\/|[a-z]:[\\/]|\\\\)/iu.test(spec)) return "path";
  if (/^[^@/\s]+\/[^/\s]+(?:#.*)?$/u.test(spec)) return "git";
  return undefined;
}

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

function validateCompatibleVersion(manifest, edge, versions) {
  const version = versions.get(edge.name);
  if (version && !semver.satisfies(version, edge.spec, { includePrerelease: true })) {
    throw new Error(`${manifest.name} requires ${edge.name}@${edge.spec}, supplied ${version}`);
  }
}

export function validatePackedDependencies(manifest, versions) {
  for (const edge of dependencyEdges(manifest)) {
    const kind = nonRegistrySpecKind(edge.spec);
    if (kind) throw new Error(`${manifest.name} leaks ${kind} dependency ${edge.name}@${edge.spec}`);
    validateCompatibleVersion(manifest, edge, versions);
  }
}

export function inspectPackedDependencies(manifest, versions, allowedHolds) {
  const blockers = [];
  for (const edge of dependencyEdges(manifest)) {
    const kind = nonRegistrySpecKind(edge.spec);
    if (!kind) validateCompatibleVersion(manifest, edge, versions);
    else if (!allowedHolds.has(edge.name)) {
      throw new Error(`${manifest.name} leaks ${kind} dependency ${edge.name}@${edge.spec}`);
    } else blockers.push({ ...edge, kind });
  }
  return blockers;
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
  return files;
}

function exportedSubpaths(exportsMap) {
  if (typeof exportsMap === "string" || Array.isArray(exportsMap)) return ["."];
  const keys = Object.keys(exportsMap ?? {});
  const subpaths = keys.filter((key) => key.startsWith("."));
  return subpaths.length > 0 ? subpaths : ["."];
}

function matchesExport(subpath, exportKey) {
  if (!exportKey.includes("*")) return subpath === exportKey;
  const [prefix, suffix] = exportKey.split("*");
  return subpath.startsWith(prefix) && subpath.endsWith(suffix);
}

function validatePackageRequest(request, packageExports, owner, file) {
  if (!request.startsWith("@ghost/") && !request.startsWith("@ghost-shell/")) return;
  const segments = request.split("/");
  const packageName = segments.slice(0, 2).join("/");
  const exportsMap = packageExports.get(packageName);
  if (!exportsMap) throw new Error(`${owner} imports unknown Ghost package ${packageName} in ${file}`);
  const subpath = segments.length === 2 ? "." : `./${segments.slice(2).join("/")}`;
  if (!exportedSubpaths(exportsMap).some((key) => matchesExport(subpath, key))) {
    throw new Error(`${owner} imports undeclared subpath ${request} in ${file}`);
  }
}

export async function validatePackedImports(root, files, packageName, packageExports) {
  const textFiles = files.filter((path) => /\.(?:js|cjs|mjs|d\.ts|d\.cts|json)$/.test(path));
  for (const path of textFiles) {
    const source = await readFile(join(root, path), "utf8");
    const requests = ts.preProcessFile(source, true, true).importedFiles.map(({ fileName }) => fileName);
    for (const request of requests) validatePackageRequest(request, packageExports, packageName, path);
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
