import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

function assertExactList(actual, expected, label) {
  const left = JSON.stringify([...actual].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) throw new Error(`${label} mismatch: actual=${left} expected=${right}`);
}

function exposeIdentity(expose, remote, pluginPath) {
  if (!expose || typeof expose !== "object") throw new Error(`${pluginPath} has malformed expose metadata`);
  const expectedName = typeof expose.path === "string" ? expose.path.replace(/^\.\//, "") : "";
  if (expose.name !== expectedName || expose.id !== `${remote}:${expectedName}`) {
    throw new Error(`${pluginPath} expose identity does not match ${expose.path}`);
  }
  return expose.path;
}

function validateExposes(manifest, plugin) {
  if (!Array.isArray(manifest.exposes)) throw new Error(`${plugin.path} manifest exposes must be an array`);
  const paths = manifest.exposes.map((expose) => exposeIdentity(expose, plugin.remote, plugin.path));
  if (new Set(paths).size !== paths.length) throw new Error(`${plugin.path} manifest contains duplicate exposes`);
  assertExactList(paths, plugin.exposes, `${plugin.path} manifest exposes`);
}

function collectStrings(value, target) {
  if (typeof value === "string") target.push(value);
  else if (Array.isArray(value)) for (const child of value) collectStrings(child, target);
  else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectStrings(child, target);
  }
}

function collectAssetReferences(manifest) {
  const references = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "assets") collectStrings(child, references);
      else visit(child);
    }
  }
  visit(manifest);
  return references;
}

function metadataReferences(manifest, artifacts, pluginPath) {
  const metadata = manifest.metaData;
  if (!metadata || typeof metadata !== "object") throw new Error(`${pluginPath} lacks manifest metadata`);
  const remote = metadata.remoteEntry;
  if (!remote || typeof remote.name !== "string" || typeof remote.path !== "string") {
    throw new Error(`${pluginPath} has malformed remote entry metadata`);
  }
  const remoteReference = [remote.path, remote.name].filter(Boolean).join("/");
  if (remoteReference !== artifacts.remoteEntry) throw new Error(`${pluginPath} remote entry metadata drifted`);
  return [remoteReference];
}

async function assertContainedFile(outputRoot, reference, label) {
  if (!reference || reference.includes("\\") || /^[a-z][a-z+.-]*:/iu.test(reference)) {
    throw new Error(`${label} has invalid asset path ${reference}`);
  }
  const path = resolve(outputRoot, reference);
  const contained = relative(outputRoot, path);
  if (contained.startsWith("..") || isAbsolute(contained))
    throw new Error(`${label} asset escapes output: ${reference}`);
  try {
    if (!(await stat(path)).isFile()) throw new Error(`${label} asset is not a file: ${reference}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("asset is not a file")) throw error;
    throw new Error(`${label} references missing asset ${reference}`);
  }
}

function validateManifestIdentity(manifest, plugin) {
  if (manifest.id !== plugin.remote || manifest.name !== plugin.remote || manifest.metaData?.name !== plugin.remote) {
    throw new Error(`${plugin.path} manifest id/name does not match ${plugin.remote}`);
  }
}

export async function validatePluginManifest(plugin, artifacts, outputRoot) {
  const manifestPath = join(outputRoot, artifacts.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifestIdentity(manifest, plugin);
  validateExposes(manifest, plugin);
  const assetReferences = collectAssetReferences(manifest);
  const metadataAssets = metadataReferences(manifest, artifacts, plugin.path);
  const rootArtifacts = new Set(metadataAssets);
  for (const reference of assetReferences) {
    if (!rootArtifacts.has(reference) && !reference.startsWith(`${artifacts.assetDirectory}/`)) {
      throw new Error(`${plugin.path} asset is outside ${artifacts.assetDirectory}: ${reference}`);
    }
  }
  const references = [...new Set([...metadataAssets, ...assetReferences])];
  for (const reference of references) await assertContainedFile(outputRoot, reference, plugin.path);
  return { manifest, referencedAssets: references };
}
